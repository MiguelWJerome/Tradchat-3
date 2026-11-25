import os
import sys

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from Server import app, db_sql

def run_tests():
    print("=== Running Profile Links Verification Tests ===")
    client = app.test_client()

    user_rows = db_sql("SELECT id, username, password FROM accounts LIMIT 2;", "accounts")
    assert user_rows, "No accounts found in database"
    test_user_id, test_username, test_password = user_rows[0]

    with client.session_transaction() as sess:
        sess['username'] = test_username
        sess['password'] = test_password

    # Test 1: Feed Page HTML contains post author profile links
    print("\n--- Test 1: Post Author Profile Links on Feed ---")
    resp = client.get('/feed/')
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"
    html = resp.get_data(as_text=True)

    assert 'class="post-author-avatar-link"' in html, "post-author-avatar-link not found in feed.html"
    assert 'class="post-author-name-link"' in html, "post-author-name-link not found in feed.html"
    assert '/profile/' in html, "/profile/ links not found in feed.html"
    print("PASS: Post author avatars and names in feed.html link directly to /profile/<username>/.")

    # Test 2: Feed JavaScript contains dynamic post & comment profile links
    print("\n--- Test 2: Feed JS Dynamic Profile Links (Posts & Comments) ---")
    with open('static/javascript/feed.js', 'r') as f:
        feed_js = f.read()

    assert 'post-author-avatar-link' in feed_js
    assert 'post-author-name-link' in feed_js
    assert 'comment-avatar-link' in feed_js
    assert 'comment-author-name-link' in feed_js
    assert '/profile/${encodeURIComponent(post.author.username)}/' in feed_js
    assert '/profile/${encodeURIComponent(comment.author.username)}/' in feed_js
    print("PASS: Dynamic post cards and threaded comments link avatars and author names to /profile/<username>/.")

    # Test 3: Settings Page Composer Avatar links to user's own profile
    print("\n--- Test 3: Settings Composer Avatar Link ---")
    resp_settings = client.get('/settings/?tab=posts')
    assert resp_settings.status_code == 200
    html_settings = resp_settings.get_data(as_text=True)
    expected_own_link = f'href="/profile/{test_username}/"'
    assert expected_own_link in html_settings, f"Expected own profile link {expected_own_link} in settings.html"
    print(f"PASS: User's own avatar in composer links to their profile ({expected_own_link}).")

    # Test 4: Members Directory Click Handlers
    print("\n--- Test 4: Members Directory Avatar & Name Handlers ---")
    with open('static/javascript/looks/members.js', 'r') as f:
        members_js = f.read()

    assert '.member-avatar-wrap, .member-name, .member-username' in members_js
    assert '/profile/${encodeURIComponent(user)}/' in members_js
    print("PASS: Members directory attaches click handlers on avatar, name, and username to navigate to profile.")

    # Test 5: Profile page loads successfully for target user
    print("\n--- Test 5: Profile Route Navigation Verification ---")
    resp_profile = client.get(f'/profile/{test_username}/')
    assert resp_profile.status_code == 200, f"Expected 200 OK for /profile/{test_username}/, got {resp_profile.status_code}"
    print(f"PASS: Navigating to /profile/{test_username}/ returned HTTP 200 OK.")

    print("\n========================================================")
    print("ALL PROFILE LINK VERIFICATION TESTS PASSED! 🎯")
    print("========================================================")

if __name__ == '__main__':
    run_tests()
