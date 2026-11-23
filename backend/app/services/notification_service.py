import requests
from datetime import datetime, timezone
from app.db import local_db
from app.config import (
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,
    RESEND_API_KEY,
    FROM_EMAIL,
    IS_SUPABASE_CONFIGURED,
    SUPABASE_URL,
    SUPABASE_KEY
)

def record_notification(record: dict):
    try:
        if IS_SUPABASE_CONFIGURED:
            try:
                requests.post(
                    f"{SUPABASE_URL}/rest/v1/notifications",
                    headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json"
                    },
                    json=record,
                    timeout=5
                )
                return
            except Exception as e:
                print(f"[NotificationLedger] Supabase write fallback: {e}")

        local_db.insert("notifications", record)
    except Exception as err:
        print(f"[NotificationLedger] Error: {err}")


def send_notification(
    test_id: str,
    patient_id: str,
    notification_type: str,
    recipient_phone: str = None,
    recipient_email: str = None,
    tracking_number: str = "",
    priority: str = None
) -> list:
    notifications = []
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Prepare Message Templates
    sms_message = ""
    email_subject = ""
    email_body = ""

    if notification_type == "REGISTRATION":
        sms_message = f"Your laboratory test has been registered successfully. Tracking ID: {tracking_number}. Priority: {priority or 'Assigned'}. Track status at LabFlow Portal."
        email_subject = f"LabFlow Test Registration - Tracking ID {tracking_number}"
        email_body = (
            f"Dear Patient,\n\n"
            f"Your laboratory test has been registered successfully.\n\n"
            f"Tracking ID: {tracking_number}\n"
            f"Priority Level: {priority or 'Under Evaluation'}\n\n"
            f"Please visit the LabFlow portal to monitor your test progress."
        )
    elif notification_type == "COMPLETED":
        sms_message = f"Your laboratory test has been completed successfully. Tracking ID: {tracking_number}. Please visit the LabFlow portal to check your test status and access your report."
        email_subject = f"Your Laboratory Test Results are Ready - Tracking ID {tracking_number}"
        email_body = (
            f"Dear Patient,\n\n"
            f"Your laboratory test has been completed successfully.\n\n"
            f"Tracking ID: {tracking_number}\n\n"
            f"Please visit the LabFlow portal to check your test status and download your verified report."
        )
    elif notification_type == "PRIORITY_REVIEW":
        sms_message = f"LabFlow Admin Alert: Test {tracking_number} requires medical priority review."
        email_subject = f"[URGENT] Priority Review Required for Test {tracking_number}"
        email_body = (
            f"A new test request (ID: {tracking_number}) could not be automatically evaluated "
            f"and requires immediate administrator priority assignment."
        )

    # 2. Process SMS Channel
    if recipient_phone and sms_message:
        is_twilio_configured = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER)
        status = "SENT"
        provider_response = {
            "simulated": True,
            "note": "Simulated delivery (Twilio credentials not configured in .env)"
        }
        error_message = None

        if is_twilio_configured:
            try:
                # Live Twilio dispatch via REST API
                url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
                resp = requests.post(
                    url,
                    auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
                    data={
                        "From": TWILIO_PHONE_NUMBER,
                        "To": recipient_phone,
                        "Body": sms_message
                    },
                    timeout=5
                )
                if resp.status_code in [200, 201]:
                    provider_response = resp.json()
                else:
                    status = "FAILED"
                    error_message = resp.text
            except Exception as err:
                status = "FAILED"
                error_message = str(err)

        sms_record = {
            "test_id": test_id,
            "patient_id": patient_id,
            "notification_type": notification_type,
            "channel": "SMS",
            "recipient": recipient_phone,
            "message": sms_message,
            "delivery_status": status,
            "provider_response": provider_response,
            "error_message": error_message,
            "sent_at": now_iso if status == "SENT" else None,
            "created_at": now_iso
        }
        record_notification(sms_record)
        notifications.append(sms_record)

    # 3. Process Email Channel
    if recipient_email and email_body:
        is_resend_configured = bool(RESEND_API_KEY)
        status = "SENT"
        provider_response = {
            "simulated": True,
            "note": "Simulated delivery (Resend credentials not configured in .env)"
        }
        error_message = None

        if is_resend_configured:
            try:
                # Live Resend dispatch via REST API
                url = "https://api.resend.com/emails"
                resp = requests.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": FROM_EMAIL or "notifications@labflow.health",
                        "to": [recipient_email],
                        "subject": email_subject,
                        "text": email_body
                    },
                    timeout=5
                )
                if resp.status_code in [200, 201]:
                    provider_response = resp.json()
                else:
                    status = "FAILED"
                    error_message = resp.text
            except Exception as err:
                status = "FAILED"
                error_message = str(err)

        email_record = {
            "test_id": test_id,
            "patient_id": patient_id,
            "notification_type": notification_type,
            "channel": "EMAIL",
            "recipient": recipient_email,
            "message": f"{email_subject}\n\n{email_body}",
            "delivery_status": status,
            "provider_response": provider_response,
            "error_message": error_message,
            "sent_at": now_iso if status == "SENT" else None,
            "created_at": now_iso
        }
        record_notification(email_record)
        notifications.append(email_record)

    return notifications
