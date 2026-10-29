import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { matchRoutes } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { describe, expect, it } from "vitest";
import { ROOM_JOIN_ROUTE, roomJoinUrl } from "./roomJoin";

const origin = "https://ktv-assistant.bradwang1995.workers.dev";

describe("compact room join links", () => {
  it("keeps the same origin and room identity in the mobile route", () => {
    const url = new URL(roomJoinUrl(origin, "ab12cd34"));
    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe("/j/ab12cd34");
    expect(matchRoutes([{ path: ROOM_JOIN_ROUTE }], url.pathname)?.[0].params.roomId)
      .toBe("ab12cd34");
    expect(url.search).toBe("");
  });

  it("reduces the QR grid without lowering M error correction or the quiet zone", () => {
    const cells = (value: string) => {
      const svg = renderToStaticMarkup(createElement(QRCodeSVG, {
        value, level: "M", marginSize: 4, size: 72,
      }));
      return Number(svg.match(/viewBox="0 0 (\d+)/)?.[1]);
    };
    const original = `${origin}/room/ab12cd34/mobile`;
    const compact = roomJoinUrl(origin, "ab12cd34");
    expect(compact.length).toBeLessThan(original.length);
    expect(cells(compact)).toBeGreaterThan(0);
    expect(cells(compact)).toBeLessThan(cells(original));
  });
});
