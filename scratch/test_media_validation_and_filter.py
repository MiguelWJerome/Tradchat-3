import io
import json
import os
import sys

# Ensure repository root is in sys.path
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from Server import app, db_sql, find_account_id_or_password_or_gender

def run_tests():
    print("=== Running Feed Media Validation and User Posts Insulation Tests ===")
    client = app.test_client()

    # 1. Fetch an existing user for testing
    user_rows = db_sql("SELECT id, username, first_name, last_name FROM accounts LIMIT 5;", "accounts")
    if not user_rows:
        print("ERROR: No accounts found in DB.")
        sys.exit(1)

    test_user_id, test_username, first_name, last_name = user_rows[0]
    print(f"Testing with account: {test_username} (ID: {test_user_id})")

    # Log in session for client
    with client.session_transaction() as sess:
        # Find password
        pwd_row = db_sql("SELECT password FROM accounts WHERE username = ?;", "accounts", params=[test_username])
        test_pwd = pwd_row[0][0] if pwd_row else "test"
        sess['username'] = test_username
        sess['password'] = test_pwd

    # -------------------------------------------------------------
    # TEST 1: Reject PDF and TXT File Uploads
    # -------------------------------------------------------------
    print("\n--- Test 1: File Upload Validation (Reject PDF & TXT) ---")
    data_pdf = {
        'content': 'Attempting to upload a PDF document',
        'media_0': (io.BytesIO(b"%PDF-1.4 Fake PDF content"), 'sample.pdf')
    }
    resp = client.post('/api/feed/posts/', data=data_pdf, content_type='multipart/form-data')
    print(f"PDF Upload Response: status={resp.status_code}, data={resp.get_json()}")
    assert resp.status_code == 400, f"Expected 400 Bad Request for PDF, got {resp.status_code}"
    assert "Only pictures" in resp.get_json().get("message", "")
    print("PASS: PDF file upload correctly rejected with HTTP 400.")

    data_txt = {
        'content': 'Attempting to upload a text file',
        'media_0': (io.BytesIO(b"Just plain text file"), 'notes.txt')
    }
    resp = client.post('/api/feed/posts/', data=data_txt, content_type='multipart/form-data')
    print(f"TXT Upload Response: status={resp.status_code}, data={resp.get_json()}")
    assert resp.status_code == 400, f"Expected 400 Bad Request for TXT, got {resp.status_code}"
    print("PASS: TXT file upload correctly rejected with HTTP 400.")

    # -------------------------------------------------------------
    # TEST 2: Reject Non-Media URLs in JSON
    # -------------------------------------------------------------
    print("\n--- Test 2: URL Payload Validation (Reject document URLs) ---")
    bad_url_payload = {
        'content': 'Check this document',
        'media': [{'type': 'image', 'url': 'https://example.com/report.pdf'}]
    }
    resp = client.post('/api/feed/posts/', json=bad_url_payload)
    print(f"Bad URL Response: status={resp.status_code}, data={resp.get_json()}")
    assert resp.status_code == 400, f"Expected 400 Bad Request for PDF URL, got {resp.status_code}"
    print("PASS: Non-media URL correctly rejected with HTTP 400.")

    # -------------------------------------------------------------
    # TEST 3: Accept Valid Media Upload (PNG image)
    # -------------------------------------------------------------
    print("\n--- Test 3: Valid Media Upload (PNG) ---")
    # 1x1 transparent PNG bytes
    png_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82'
    data_png = {
        'content': 'Valid PNG upload test post by ' + test_username,
        'media_0': (io.BytesIO(png_bytes), 'valid_test_image.png')
    }
    resp = client.post('/api/feed/posts/', data=data_png, content_type='multipart/form-data')
    print(f"PNG Upload Response: status={resp.status_code}, data={resp.get_json()}")
    assert resp.status_code == 200, f"Expected 200 OK for PNG, got {resp.status_code}"
    created_post_id = resp.get_json().get('post_id')
    print(f"PASS: Valid PNG upload accepted, post ID: {created_post_id}")

    # -------------------------------------------------------------
    # TEST 4: Query User's Posts (/api/feed/posts/?user=...)
    # -------------------------------------------------------------
    print("\n--- Test 4: User-Filtered Posts Query (/api/feed/posts/?user=...) ---")
    resp = client.get(f'/api/feed/posts/?user={test_username}')
    assert resp.status_code == 200
    user_feed_data = resp.get_json()
    posts = user_feed_data.get('posts', [])
    print(f"Retrieved {len(posts)} posts for user {test_username}")
    assert len(posts) > 0, "Expected at least 1 post for user"

    # Verify all returned posts strictly belong to test_username
    for p in posts:
        assert p['author']['username'].lower() == test_username.lower(), \
            f"Post {p['id']} author {p['author']['username']} does not match queried {test_username}"

    # Verify strict descending order (newest first: id descending)
    post_ids = [p['id'] for p in posts]
    print(f"Returned Post IDs: {post_ids}")
    assert post_ids == sorted(post_ids, reverse=True), "Posts are NOT strictly sorted newest first (id DESC)!"
    print("PASS: User's posts strictly belong to target user and are sorted newest first.")

    # -------------------------------------------------------------
    # TEST 5: Render Feed Page for User Posts (/feed/?user=...)
    # -------------------------------------------------------------
    print("\n--- Test 5: Feed Page Template Rendering with User View ---")
    resp = client.get(f'/feed/?user={test_username}')
    assert resp.status_code == 200
    html = resp.get_data(as_text=True)
    assert 'class="user-posts-header"' in html, "user-posts-header not found in rendered HTML"
    assert f"{first_name}" in html or f"{test_username}" in html, "Author name not found in header"
    print("PASS: User posts header successfully rendered on /feed/?user=...")

    # Test empty state for user with 0 posts
    resp_empty = client.get('/feed/?user=NonExistentUser9999')
    assert resp_empty.status_code == 200
    html_empty = resp_empty.get_data(as_text=True)
    assert "No Posts Yet" in html_empty, "Expected 'No Posts Yet' in empty state"
    print("PASS: Empty state for user with no posts verified.")

    # -------------------------------------------------------------
    # TEST 6: Profile Page "Posts" Link Verification
    # -------------------------------------------------------------
    print("\n--- Test 6: Profile Page Posts Button Link ---")
    resp_prof = client.get(f'/profile/{test_username}/')
    assert resp_prof.status_code == 200
    html_prof = resp_prof.get_data(as_text=True)
    expected_profile_link = f'href="/feed/?user={test_username}"'
    assert expected_profile_link in html_prof, f"Expected {expected_profile_link} in profile.html"
    assert 'class="profile-side-btn"' in html_prof
    print(f"PASS: Profile page contains active 'Posts' link to /feed/?user={test_username}.")

    # -------------------------------------------------------------
    # TEST 7: General Feed Page Does Not Show User Header
    # -------------------------------------------------------------
    print("\n--- Test 7: General Feed Page (/feed/) Standard View ---")
    resp_feed = client.get('/feed/')
    assert resp_feed.status_code == 200
    html_feed = resp_feed.get_data(as_text=True)
    assert 'class="user-posts-header"' not in html_feed, "General feed should NOT have user-posts-header"
    print("PASS: General community feed cleanly excludes user-posts header.")

    # -------------------------------------------------------------
    # TEST 8: Members JS and CSS Verification
    # -------------------------------------------------------------
    print("\n--- Test 8: Members JS / CSS Asset Verification ---")
    with open('static/javascript/looks/members.js', 'r') as f:
        members_js = f.read()
    assert 'member-posts-btn' in members_js
    assert '/feed/?user=' in members_js

    with open('static/css/members.css', 'r') as f:
        members_css = f.read()
    assert '.member-posts-btn' in members_css
    assert '.member-card-actions' in members_css
    print("PASS: Members UI JS & CSS contain member-posts-btn styles and markup.")

    print("\n========================================================")
    print("ALL 8 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎯")
    print("========================================================")

if __name__ == '__main__':
    run_tests()
