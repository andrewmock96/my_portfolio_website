import unittest

from app import app


class PortfolioSiteTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_home_page_renders(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("I build useful things for the web.", response.get_data(as_text=True))
        self.assertIn("Project Alpha", response.get_data(as_text=True))

    def test_public_pages_render(self):
        for path in ("/projects", "/about", "/contact", "/robots.txt", "/sitemap.xml"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 200)

    def test_projects_page_lists_all_projects(self):
        body = self.client.get("/projects").get_data(as_text=True)
        self.assertIn("Project Alpha", body)
        self.assertIn("Project Beta", body)
        self.assertIn("Project Gamma", body)

    def test_unknown_page_uses_404_template(self):
        response = self.client.get("/missing")
        self.assertEqual(response.status_code, 404)
        self.assertIn("Page not found", response.get_data(as_text=True))

    def test_security_headers_are_set(self):
        response = self.client.get("/")
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response.headers["X-Frame-Options"], "DENY")


if __name__ == "__main__":
    unittest.main()
