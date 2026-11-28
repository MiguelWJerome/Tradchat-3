import os
import sys

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from Server import app, db_sql

def run_tests():
    print("=== Running Navbar Profile Picture Verification Tests ===")
    client = app.test_client()

    user_rows = db_sql("SELECT id, username, password FROM accounts LIMIT 1;", "accounts")
    assert user_rows, "No accounts found in database."
    test_user_id, test_username, test_password = user_rows[0]
    print(f"Testing with account: {test_username}")

    with client.session_transaction() as sess:
        sess['username'] = test_username
        sess['password'] = test_password

    # Test pages that inherit tradchat.html
    test_urls = ['/feed/', '/policy/', '/members/']

    for url in test_urls:
        print(f"\nTesting navbar avatar on {url}...")
        resp = client.get(url)
        assert resp.status_code == 200, f"Expected 200 for {url}, got {resp.status_code}"
        html = resp.get_data(as_text=True)

        expected_avatar_src = f'src="/static/profile-pictures/{test_username}.png"'
        assert expected_avatar_src in html, f"Expected avatar {expected_avatar_src} not found on {url}"
        assert 'class="navbar-profile-avatar"' in html, f"navbar-profile-avatar class not found on {url}"
        assert 'navbar-profile-button' in html, f"navbar-profile-button not found on {url}"
        print(f"PASS: {url} contains user's profile picture in the navbar Settings button.")

    print("\n========================================================")
    print("ALL NAVBAR AVATAR TESTS PASSED! 🎯")
    print("========================================================")

if __name__ == '__main__':
    run_tests()
