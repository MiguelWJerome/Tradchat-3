import os
import sys

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from Server import app, db_sql

def run_tests():
    print("=== Running Policy Page Verification Tests ===")
    client = app.test_client()

    # 1. Unauthenticated request should redirect to /
    print("\n--- Test 1: Unauthenticated Access ---")
    resp_unauth = client.get('/policy/')
    assert resp_unauth.status_code == 302, f"Expected 302 Redirect for unauthenticated access, got {resp_unauth.status_code}"
    assert resp_unauth.headers.get('Location') == '/', f"Expected redirect to '/', got {resp_unauth.headers.get('Location')}"
    print("PASS: Unauthenticated visitor correctly redirected to '/'.")

    # 2. Authenticated access
    print("\n--- Test 2: Authenticated Access & Rendering ---")
    user_rows = db_sql("SELECT id, username, password FROM accounts LIMIT 1;", "accounts")
    assert user_rows, "No test accounts found in database."
    test_user_id, test_username, test_password = user_rows[0]
    print(f"Testing with account: {test_username}")

    with client.session_transaction() as sess:
        sess['username'] = test_username
        sess['password'] = test_password

    resp_auth = client.get('/policy/')
    assert resp_auth.status_code == 200, f"Expected 200 OK, got {resp_auth.status_code}"
    html = resp_auth.get_data(as_text=True)

    # 3. Check exact wireframe text
    print("\n--- Test 3: Wireframe Content Verification ---")
    expected_texts = [
        "Tradchat policies",
        "A few shared guidelines for our time together on TradChat.",
        "01",
        "Keep language respectful",
        "No vulgar language",
        "02",
        "Lead with charity",
        "Be charitable towards others",
        "03",
        "Message &amp; post archives",
        "All messages/posts will be archived for parents use only",
        "04",
        "Who TradChat is for",
        "TradChat is for traditional, traditional Catholic children only (no Stay-at-Home or Novus Ordo)",
        "Questions, concerns or problems?",
        "tradchatforkids@gmail.com",
        "Back to home",
        'href="/home/"'
    ]

    for text in expected_texts:
        assert text in html, f"Missing expected text in rendered policy page: {text}"
    print("PASS: All titles, descriptions, badge numbers, email link, and home button verified.")

    # 4. Check external CSS and rule compliance (no embedded styles)
    print("\n--- Test 4: CSS Architecture & Rule Compliance ---")
    with open('templates/policy.html', 'r') as f:
        template_raw = f.read()
    assert '<style>' not in template_raw, "Found embedded <style> in templates/policy.html! Must use static/css/policy.css."
    assert '<script>' not in template_raw, "Found embedded <script> in templates/policy.html!"
    assert '/static/css/policy.css' in template_raw, "Missing policy.css stylesheet link."
    print("PASS: Clean separation verified. Zero embedded CSS/JS in template.")

    # 5. Check navbar in tradchat.html
    print("\n--- Test 5: Navbar Active Indicator & Link Verification ---")
    assert 'data-page="policy"' in html
    assert 'class="nav-item active"' in html or 'class="nav-item  active"' in html
    assert "onclick=\"window.location.href='/policy/'\"" in html
    print("PASS: Desktop & dropdown navbar integration with active indicator verified.")

    print("\n========================================================")
    print("ALL POLICY PAGE TESTS PASSED SUCCESSFULLY! 🎯")
    print("========================================================")

if __name__ == '__main__':
    run_tests()
