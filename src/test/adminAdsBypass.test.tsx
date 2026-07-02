import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

// Mock all hooks used by AdSlot & MultiAdSlot BEFORE importing them.
const permissionsMock = vi.fn();
const siteSettingsMock = vi.fn();
const publicSettingsMock = vi.fn();
const adClickCtxMock = vi.fn();

vi.mock("@/hooks/usePermissions", () => ({
  useCurrentUserPermissions: () => permissionsMock(),
}));
vi.mock("@/hooks/useSiteSettings", () => ({
  useSiteSettings: () => siteSettingsMock(),
}));
vi.mock("@/hooks/usePublicSiteSettings", () => ({
  usePublicSiteSettings: () => publicSettingsMock(),
}));
vi.mock("@/components/AdClickProtectionProvider", () => ({
  useAdClickProtectionContext: () => adClickCtxMock(),
}));
vi.mock("@/hooks/useGoogleAnalytics", () => ({
  trackAdImpression: vi.fn(),
}));

import AdSlot from "@/components/AdSlot";
import MultiAdSlot from "@/components/MultiAdSlot";

const AD_HTML = '<div style="width:300px;height:250px;background:#f00" data-testid="ad-content">AD</div>';

const fullSettings = {
  ads_enabled: true,
  header_ad_code: AD_HTML,
  sidebar_ad_code: AD_HTML,
  footer_ad_code: AD_HTML,
  in_article_ad_code: AD_HTML,
  popup_ad_code: AD_HTML,
  multiple_ad_codes: {
    header: [{ id: "1", name: "h", code: AD_HTML, enabled: true }],
    sidebar: [{ id: "2", name: "s", code: AD_HTML, enabled: true }],
    footer: [{ id: "3", name: "f", code: AD_HTML, enabled: true }],
    in_article: [{ id: "4", name: "i", code: AD_HTML, enabled: true }],
    popup: [{ id: "5", name: "p", code: AD_HTML, enabled: true }],
  },
};

beforeEach(() => {
  cleanup();
  adClickCtxMock.mockReturnValue({ isBlocked: false, trackAdClick: vi.fn() });
  siteSettingsMock.mockReturnValue({ data: fullSettings });
  publicSettingsMock.mockReturnValue({ data: fullSettings });
});

const POSITIONS = ["header", "sidebar", "footer", "in_article", "popup"] as const;

describe("Admin bypass: AdSlot", () => {
  it("renders ad HTML when NOT admin (sanity)", () => {
    permissionsMock.mockReturnValue({ isAdmin: false });
    const { container } = render(<AdSlot position="header" />);
    expect(container.querySelector(".ad-slot-header")).toBeInTheDocument();
    expect(container.querySelector('[data-testid="ad-content"]')).toBeInTheDocument();
  });

  it.each(POSITIONS)("renders nothing when admin (position=%s)", (position) => {
    permissionsMock.mockReturnValue({ isAdmin: true });
    const { container } = render(<AdSlot position={position} />);
    expect(container.firstChild).toBeNull();
    expect(container.querySelector('[data-testid="ad-content"]')).toBeNull();
  });

  it("renders nothing for popup when admin (no popups shown)", () => {
    permissionsMock.mockReturnValue({ isAdmin: true });
    const { container } = render(<AdSlot position="popup" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("Admin bypass: MultiAdSlot", () => {
  it("renders ads when NOT admin (sanity)", () => {
    permissionsMock.mockReturnValue({ isAdmin: false });
    const { container } = render(<MultiAdSlot position="header" />);
    expect(container.querySelector(".multi-ad-slot-header")).toBeInTheDocument();
    expect(container.querySelector('[data-testid="ad-content"]')).toBeInTheDocument();
  });

  it.each(POSITIONS)("renders nothing when admin (position=%s)", (position) => {
    permissionsMock.mockReturnValue({ isAdmin: true });
    const { container } = render(
      <MultiAdSlot position={position} fallbackPosition={position} />,
    );
    expect(container.firstChild).toBeNull();
    expect(container.querySelector('[data-testid="ad-content"]')).toBeNull();
  });

  it("ignores legacy fallback ad code when admin", () => {
    permissionsMock.mockReturnValue({ isAdmin: true });
    publicSettingsMock.mockReturnValue({
      data: { ...fullSettings, multiple_ad_codes: null },
    });
    const { container } = render(
      <MultiAdSlot position="header" fallbackPosition="header" />,
    );
    expect(container.firstChild).toBeNull();
  });
});