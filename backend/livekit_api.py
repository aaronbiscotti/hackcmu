import os
import random
import string
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from livekit.api import AccessToken, VideoGrants


class ConnectionDetails(BaseModel):
    serverUrl: str
    roomName: str
    participantName: str
    participantToken: str


class TokenResponse(BaseModel):
    token: str


def random_string(length: int) -> str:
    """Generate a random string of given length."""
    characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return ''.join(random.choice(characters) for _ in range(length))


def get_livekit_url(url: str, region: Optional[str] = None) -> str:
    """Get LiveKit URL with optional region."""
    if not region or region == 'default':
        return url

    try:
        from urllib.parse import urlparse, urlunparse
        parsed = urlparse(url)
        hostname = f"{region}.{parsed.hostname}"
        return urlunparse((parsed.scheme, hostname + (f":{parsed.port}" if parsed.port else ""),
                          parsed.path, parsed.params, parsed.query, parsed.fragment))
    except Exception:
        return url


def create_participant_token(identity: str, name: str, metadata: str, room_name: str) -> str:
    """Create a participant token for LiveKit."""
    api_key = os.getenv('LIVEKIT_API_KEY')
    api_secret = os.getenv('LIVEKIT_API_SECRET')

    if not api_key or not api_secret:
        raise HTTPException(status_code=500, detail="LiveKit API credentials not configured")

    try:
        token = AccessToken(api_key, api_secret)
        token.with_identity(identity).with_name(name).with_metadata(metadata)
        token.with_grants(VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_publish_data=True,
            can_subscribe=True,
        ))
        token.with_ttl(timedelta(minutes=5))
        return token.to_jwt()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token generation failed: {str(e)}")


def get_cookie_expiration_time() -> str:
    """Get cookie expiration time (2 hours from now)."""
    expire_time = datetime.utcnow() + timedelta(hours=2)
    return expire_time.strftime('%a, %d %b %Y %H:%M:%S GMT')


def setup_livekit_routes(app: FastAPI):
    """Add LiveKit routes to the FastAPI app."""

    COOKIE_KEY = 'random-participant-postfix'

    @app.get("/api/connection-details", response_model=ConnectionDetails)
    async def get_connection_details(
        request: Request,
        response: Response,
        roomName: str,
        participantName: str,
        metadata: str = "",
        region: Optional[str] = None
    ):
        """Get connection details for joining a LiveKit room."""
        try:
            livekit_url = os.getenv('NEXT_PUBLIC_LIVEKIT_URL') or os.getenv('LIVEKIT_URL')
            if not livekit_url:
                raise HTTPException(status_code=500, detail="LIVEKIT_URL is not defined")

            # Get LiveKit server URL with optional region
            livekit_server_url = get_livekit_url(livekit_url, region) if region else livekit_url

            # Use participant name directly as identity
            participant_identity = participantName
            participant_token = create_participant_token(
                identity=participant_identity,
                name=participantName,
                metadata=metadata,
                room_name=roomName
            )


            return ConnectionDetails(
                serverUrl=livekit_server_url,
                roomName=roomName,
                participantToken=participant_token,
                participantName=participantName
            )

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/get-livekit-token", response_model=TokenResponse)
    async def get_livekit_token(room: str, username: str):
        """Get a LiveKit token for a room and username."""
        try:
            api_key = os.getenv('LIVEKIT_API_KEY')
            api_secret = os.getenv('LIVEKIT_API_SECRET')
            ws_url = os.getenv('LIVEKIT_URL')

            if not api_key or not api_secret or not ws_url:
                raise HTTPException(
                    status_code=500,
                    detail="Server misconfigured - missing environment variables"
                )

            # Create token
            token = AccessToken(api_key, api_secret)
            token.with_identity(username)
            token.with_grants(VideoGrants(
                room_join=True,
                room=room,
                can_publish=True,
                can_subscribe=True,
            ))

            jwt_token = token.to_jwt()

            return TokenResponse(token=jwt_token)

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Token generation failed: {str(e)}")