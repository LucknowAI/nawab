"""Async SMTP email sender for OTP and transactional email."""
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from src.config.settings import settings
from src.utils.util_logger.logger import logger

SMTP_TIMEOUT_SECONDS = 15


_OTP_HTML = """\
<!DOCTYPE html>
<html lang="en">
<body style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#fff">
  <h2 style="color:#1a1a1a;margin-bottom:8px">Your Nawab AI login code</h2>
  <p style="font-size:14px;color:#555;margin-top:0">
    Use this one-time code to sign in. It expires in <strong>2 minutes</strong>.
  </p>
  <div style="font-size:44px;font-weight:700;letter-spacing:12px;text-align:center;
              padding:28px 16px;background:#f5f5f5;border-radius:10px;margin:24px 0;
              color:#111">
    {otp}
  </div>
  <p style="font-size:12px;color:#aaa;margin-top:24px">
    If you did not request this code, you can safely ignore this email.
  </p>
</body>
</html>
"""


async def send_otp_email(to_email: str, otp: str) -> None:
    """Send a 6-digit OTP to *to_email* via SMTP with STARTTLS.

    Raises on any SMTP / network failure so the caller can surface a 502.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your Nawab AI login code"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email

    plain = (
        f"Your Nawab AI one-time login code is: {otp}\n\n"
        "This code expires in 2 minutes.\n"
        "If you didn't request this, ignore this email."
    )
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(_OTP_HTML.format(otp=otp), "html"))

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        start_tls=True,
        # aiosmtplib defaults to 60s, which is long enough to pin a worker on a
        # stalled connection. A healthy Gmail send measures ~4s.
        timeout=SMTP_TIMEOUT_SECONDS,
    )
    logger.info(f"[email] OTP sent to {to_email!r}")


async def send_otp_email_safe(to_email: str, otp: str) -> None:
    """send_otp_email that never raises — for use as a FastAPI background task.

    An exception escaping a background task is unhandled (the response has
    already been sent), so failures are logged here instead. The user recovers
    via the resend button; the OTP itself is already stored in Redis.
    """
    try:
        await send_otp_email(to_email, otp)
    except Exception:
        logger.exception(f"[email] failed to send OTP to {to_email!r}")
