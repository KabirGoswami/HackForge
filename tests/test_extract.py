import pytest
from engine.extract import OsintExtractor

def test_regex_extraction():
    extractor = OsintExtractor()
    text = "Contact me at hacker@darkweb.com or 0x1234567890123456789012345678901234567890. IP is 1.2.3.4 @ghost_user"
    results = extractor.regex_extract(text)

    assert "0x1234567890123456789012345678901234567890" in results["wallets"]
    assert "hacker@darkweb.com" in results["emails"]
    assert "1.2.3.4" in results["ips"]
    assert "@ghost_user" in results["handles"]

def test_extract_no_api_key():
    # Should degrade gracefully to regex only
    extractor = OsintExtractor(api_key=None)
    post = {"id": "p1", "author": "user1", "text": "Check 0x1234567890123456789012345678901234567890"}
    result = extractor.extract(post)

    assert len(result["entities"]) == 1
    assert result["entities"][0]["value"] == "0x1234567890123456789012345678901234567890"
    assert result["claims"] == []
