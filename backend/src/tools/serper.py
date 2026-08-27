"""Serper.dev client — Google search, maps, news, videos and images.

Every method returns {"status": 1, "data": ...} on success or
{"status": 0, "error": ...} on failure; callers read result["data"].
"""

import asyncio

import aiohttp
import tenacity

from src.config.settings import Settings

DEFAULT_LOCATION = "Lucknow, Uttar Pradesh, India"
DEFAULT_COORDINATES = "@26.8488213,80.8601114,12z"


class APIHandler:
    BASE_URL = "https://google.serper.dev"

    def _get_headers(self) -> dict:
        # Read the key per call rather than at init — an init-time read caches
        # whatever was in the environment when the module first imported.
        api_key = Settings.SERPER_API_KEY
        if not api_key:
            raise ValueError("SERPER_API_KEY is not set in environment variables.")
        return {"X-API-KEY": api_key, "Content-Type": "application/json"}

    @tenacity.retry(
        wait=tenacity.wait_random_exponential(multiplier=1, min=1, max=60),
        stop=tenacity.stop_after_attempt(5),
        retry=tenacity.retry_if_exception_type((aiohttp.ClientError, asyncio.TimeoutError)),
        reraise=True,
    )
    async def call_api(self, endpoint, payload):
        """POST to a Serper endpoint, converting any failure into an error dict."""
        url = f"{self.BASE_URL}/{endpoint}"
        try:
            timeout = aiohttp.ClientTimeout(total=Settings.API_TIMEOUT)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, headers=self._get_headers(), json=payload) as response:
                    response.raise_for_status()
                    return {"status": 1, "data": await response.json()}
        except aiohttp.ClientResponseError as e:
            return {"status": 0, "error": f"API request failed with status {e.status}: {e.message}", "details": str(e)}
        except asyncio.TimeoutError as e:
            return {"status": 0, "error": f"API request timed out after {Settings.API_TIMEOUT} seconds.", "details": str(e)}
        except aiohttp.ClientError as e:
            return {"status": 0, "error": "API request failed due to a client error.", "details": str(e)}
        except Exception as e:
            return {"status": 0, "error": "An unexpected error occurred during the API call.", "details": str(e)}

    async def _query(self, endpoint, keywords, **extra):
        """Join keywords into a query and call `endpoint` with any extra payload keys."""
        return await self.call_api(endpoint, {"q": " ".join(keywords), **extra})

    async def maps_api(self, keywords, coordinates: str = DEFAULT_COORDINATES):
        return await self._query("maps", keywords, ll=coordinates)

    async def news_api(self, keywords, location: str = DEFAULT_LOCATION):
        return await self._query("news", keywords, location=location, gl="in", tbs="qdr:w")

    async def video_api(self, keywords, location: str = DEFAULT_LOCATION):
        return await self._query("videos", keywords, location=location, gl="in")

    async def images_api(self, keywords, location: str = DEFAULT_LOCATION):
        return await self._query("images", keywords, location=location, gl="in")

    async def search_api(self, query: str):
        return await self._query("search", [query])
