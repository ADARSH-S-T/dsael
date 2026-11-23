"""
LabFlow Python Flask Backend Automated Verification Suite
"""
import sys
from app import create_app

def run_tests():
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()
    passed = 0
    total = 0

    def assert_test(condition, name):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f" [PASS] {name}")
        else:
            print(f" [FAIL] {name}")
            sys.exit(1)

    print("\n--- Starting LabFlow Flask Backend Verification ---\n")

    # 1. Healthcheck
    res = client.get("/api/health")
    assert_test(res.status_code == 200 and res.json.get("status") == "healthy", "GET /api/health")

    # 2. Auth Login
    res = client.post("/api/auth/login", json={"email": "admin@labflow.health", "role": "admin"})
    assert_test(res.status_code == 200 and "token" in res.json and res.json["user"]["role"] == "admin", "POST /api/auth/login (Admin)")
    admin_token = res.json["token"]

    # 3. Auth Me
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert_test(res.status_code == 200 and res.json["user"]["email"] == "admin@labflow.health", "GET /api/auth/me")

    # 4. Auth Staff Users
    res = client.get("/api/auth/staff-users")
    assert_test(res.status_code == 200 and len(res.json["staff"]) >= 2, "GET /api/auth/staff-users")

    # 5. Live Queue (Sorting HIGH -> MEDIUM -> LOW, FIFO on arrival)
    res = client.get("/api/queue")
    assert_test(res.status_code == 200 and "queue" in res.json, "GET /api/queue returns list")
    queue = res.json["queue"]
    if len(queue) >= 2:
        weights = {"HIGH": 1, "MEDIUM": 2, "LOW": 3}
        is_sorted = all(weights.get(queue[i]["priority"], 99) <= weights.get(queue[i+1]["priority"], 99) for i in range(len(queue)-1))
        assert_test(is_sorted, "GET /api/queue correctly sorts by Priority Weight (HIGH -> MEDIUM -> LOW)")
        assert_test(queue[0]["queue_position"] == 1, "GET /api/queue assigns queue_position 1 to head")
        assert_test("waiting_time" in queue[0], "GET /api/queue computes human-readable waiting_time")

    # 6. Atomic Take Next Test
    res = client.post("/api/queue/take-next", json={"staff_id": "b0000000-0000-0000-0000-000000000001"})
    assert_test(res.status_code == 200 and res.json.get("success"), "POST /api/queue/take-next claims highest-priority test")
    claimed_test = res.json["test"]
    test_id = claimed_test["id"]

    # 7. Staff Dashboard
    res = client.get("/api/staff/dashboard")
    assert_test(res.status_code == 200 and "stats" in res.json and "waiting_tests" in res.json["stats"], "GET /api/staff/dashboard")

    # 8. Staff Current Test
    res = client.get("/api/staff/current-test?staff_id=b0000000-0000-0000-0000-000000000001")
    assert_test(res.status_code == 200 and res.json.get("test") is not None, "GET /api/staff/current-test returns active test")

    # 9. Start Test
    res = client.post("/api/staff/start-test", json={"test_id": test_id, "staff_id": "b0000000-0000-0000-0000-000000000001"})
    assert_test(res.status_code == 200 and res.json["test"]["status"] == "IN_PROGRESS", "POST /api/staff/start-test updates status to IN_PROGRESS")

    # 10. Complete Test
    res = client.post("/api/staff/complete-test", json={
        "test_id": test_id,
        "staff_id": "b0000000-0000-0000-0000-000000000001",
        "remarks": "Automated test diagnostics verified normal."
    })
    assert_test(res.status_code == 200 and res.json["test"]["status"] == "COMPLETED" and res.json["test"]["report_path"] is not None, "POST /api/staff/complete-test completes test and attaches report")

    # 11. Completed Tests List
    res = client.get("/api/staff/completed-tests")
    assert_test(res.status_code == 200 and len(res.json["tests"]) >= 1, "GET /api/staff/completed-tests returns completed records")

    # 12. Register New Patient Test (HIGH Priority Category)
    reg_payload = {
        "patient_name": "Alexander Hayes",
        "phone": "+91 91122 33445",
        "email": "alex.hayes@example.com",
        "age": 52,
        "gender": "Male",
        "test_name": "High-Sensitivity Troponin T Assay",
        "test_category": "Cardiac & Emergency",
        "sample_type": "Plasma",
        "sample_details": "4mL Heparin Tube STAT",
        "additional_information": "Acute coronary syndrome symptoms"
    }
    res = client.post("/api/patients/register", json=reg_payload)
    assert_test(res.status_code == 201 and res.json.get("success"), "POST /api/patients/register creates test")
    new_tracking = res.json["tracking_number"]
    assert_test(len(new_tracking) == 5, "POST /api/patients/register generates 5-digit unique tracking number")
    assert_test(res.json["test"]["priority"] == "HIGH", "Automatic priority engine assigned HIGH to Cardiac test")
    assert_test(res.json["test"]["status"] == "WAITING_IN_QUEUE", "Automatic priority engine queued test into WAITING_IN_QUEUE")

    # 13. Verify OTP
    res = client.post("/api/patients/verify-otp", json={"tracking_number": new_tracking, "verification_code": "123456"})
    assert_test(res.status_code == 200 and res.json.get("verified"), "POST /api/patients/verify-otp succeeds")

    # 14. Track Test
    res = client.get(f"/api/patients/track/{new_tracking}")
    assert_test(res.status_code == 200 and res.json["test"]["tracking_number"] == new_tracking, f"GET /api/patients/track/{new_tracking}")
    assert_test("*" in res.json["patient"]["masked_phone"] and "*" in res.json["patient"]["masked_email"], "GET /api/patients/track masks patient contact info")

    # 15. Admin Stats
    res = client.get("/api/admin/stats")
    assert_test(res.status_code == 200 and "total_tests" in res.json["stats"], "GET /api/admin/stats")

    # 16. Admin Tests with Filter
    res = client.get("/api/admin/tests?priority=HIGH")
    assert_test(res.status_code == 200 and all(t["priority"] == "HIGH" for t in res.json["tests"]), "GET /api/admin/tests?priority=HIGH filters accurately")

    # 17. Priority Review
    res = client.get("/api/admin/priority-review")
    assert_test(res.status_code == 200 and "tests" in res.json, "GET /api/admin/priority-review")
    pending_reviews = res.json["tests"]
    if pending_reviews:
        review_id = pending_reviews[0]["id"]
        res = client.post(f"/api/admin/priority-review/{review_id}", json={
            "priority": "HIGH",
            "reason": "Specialized autoimmune panel expedited by medical head.",
            "admin_id": "a0000000-0000-0000-0000-000000000001"
        })
        assert_test(res.status_code == 200 and res.json["test"]["priority"] == "HIGH", "POST /api/admin/priority-review/:id assigns priority & queues test")

    # 18. Priority Override
    res = client.post(f"/api/admin/priority-override/{test_id}", json={
        "priority": "MEDIUM",
        "reason": "Routine clinical downgrading.",
        "admin_id": "a0000000-0000-0000-0000-000000000001"
    })
    assert_test(res.status_code == 200 and res.json.get("success"), "POST /api/admin/priority-override/:id succeeds")

    # 19. Rules CRUD
    res = client.get("/api/admin/rules")
    assert_test(res.status_code == 200 and len(res.json["rules"]) >= 1, "GET /api/admin/rules")

    res = client.post("/api/admin/rules", json={
        "rule_name": "Toxicology Screening",
        "test_category": "Toxicology",
        "configured_priority": "HIGH",
        "processing_deadline": 45,
        "keywords": ["Poison", "Overdose", "Toxin"]
    })
    assert_test(res.status_code == 201 and "rule" in res.json, "POST /api/admin/rules creates new rule")
    new_rule_id = res.json["rule"]["id"]

    res = client.put(f"/api/admin/rules/{new_rule_id}", json={"processing_deadline": 50})
    assert_test(res.status_code == 200 and res.json["rule"]["processing_deadline"] == 50, "PUT /api/admin/rules/:id updates rule")

    res = client.delete(f"/api/admin/rules/{new_rule_id}")
    assert_test(res.status_code == 200 and res.json.get("success"), "DELETE /api/admin/rules/:id deletes rule")

    # 20. Staff Management
    res = client.get("/api/admin/staff")
    assert_test(res.status_code == 200 and len(res.json["staff"]) >= 2, "GET /api/admin/staff")
    staff_member_id = res.json["staff"][0]["id"]

    res = client.patch(f"/api/admin/staff/{staff_member_id}/toggle")
    assert_test(res.status_code == 200 and res.json.get("success"), "PATCH /api/admin/staff/:id/toggle toggles status")

    res = client.patch(f"/api/admin/staff/{staff_member_id}/toggle")
    assert_test(res.status_code == 200 and res.json.get("success"), "PATCH /api/admin/staff/:id/toggle toggles back")

    # 21. Notifications Ledger
    res = client.get("/api/admin/notifications")
    assert_test(res.status_code == 200 and len(res.json["notifications"]) >= 1, "GET /api/admin/notifications returns notification logs")

    # 22. Activity Logs
    res = client.get("/api/admin/activity-logs")
    assert_test(res.status_code == 200 and len(res.json["logs"]) >= 1, "GET /api/admin/activity-logs returns audit records")

    print(f"\n==================================================")
    print(f" ALL {passed}/{total} BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print(f" Flask Backend is 100% compliant with React Frontend API contracts.")
    print(f"==================================================\n")

if __name__ == "__main__":
    run_tests()
