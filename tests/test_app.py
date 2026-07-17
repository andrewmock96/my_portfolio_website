import unittest

from app import app


class PortfolioSiteTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_home_page_renders(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Projects worth a closer look", response.get_data(as_text=True))
        self.assertIn("Satellite Orbit Simulator", response.get_data(as_text=True))
        self.assertIn("Going Indie", response.get_data(as_text=True))
        self.assertIn("360Epoxy", response.get_data(as_text=True))
        self.assertIn("360Epoxy", response.get_data(as_text=True))

    def test_public_pages_render(self):
        for path in ("/projects", "/games/satellite-orbit", "/games/apollo11", "/games/artillery", "/games/chess", "/about", "/contact", "/robots.txt", "/sitemap.xml", "/design/job-history-options"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 200)

    def test_about_page_includes_hunting_photo(self):
        body = self.client.get("/about").get_data(as_text=True)
        self.assertIn("images/about/2024-doe-hunt.webp", body)
        image_response = self.client.get("/static/images/about/2024-doe-hunt.webp")
        self.assertEqual(image_response.status_code, 200)
        image_response.close()

    def test_projects_page_lists_all_projects(self):
        body = self.client.get("/projects").get_data(as_text=True)
        self.assertIn("Satellite Orbit Simulator", body)
        self.assertIn("images/satellite-orbit-preview.webp", body)
        self.assertIn("Apollo 11 Lander", body)
        self.assertIn("Artillery Simulator", body)
        self.assertIn("Chess", body)
        self.assertIn("Play", body)
        self.assertIn("Download Windows build", body)
        self.assertLess(body.index("Satellite Orbit Simulator"), body.index("Chess"))
        self.assertLess(body.index("Chess"), body.index("Artillery Simulator"))
        self.assertLess(body.index("Artillery Simulator"), body.index("Apollo 11 Lander"))

    def test_unknown_page_uses_404_template(self):
        response = self.client.get("/missing")
        self.assertEqual(response.status_code, 404)
        self.assertIn("Page not found", response.get_data(as_text=True))

    def test_security_headers_are_set(self):
        response = self.client.get("/")
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response.headers["X-Frame-Options"], "SAMEORIGIN")


if __name__ == "__main__":
    unittest.main()
