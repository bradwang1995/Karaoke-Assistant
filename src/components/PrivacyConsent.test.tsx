import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PrivacyConsent } from "./PrivacyConsent";

describe("privacy boundary", () => {
  it("does not render protected children before consent and defaults to an unchecked disabled gate", () => {
    let mounted = false;
    function Protected() {
      mounted = true;
      return <div>Protected room</div>;
    }
    const html = renderToStaticMarkup(<MemoryRouter><PrivacyConsent><Protected /></PrivacyConsent></MemoryRouter>);
    expect(mounted).toBe(false);
    expect(html).not.toContain("Protected room");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('checked=""');
    expect(html).toContain('disabled=""');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
  });
});
