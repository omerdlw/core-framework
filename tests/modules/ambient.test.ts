import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolvePageAmbientTheme } from "../../src/modules/ambient/utils.ts";

describe("ambient page", () => {
  const BANNER = "/banner.jpg";
  const POSTER = "/api/background/youtube?id=x&stream=thumbnail";
  const theme = (ambient, { banner = null, poster = null } = {}) =>
    resolvePageAmbientTheme({ ambient, banner }, poster);

  describe("ambient page theme", () => {
    test("nothing configured: no theme", () => {
      assert.equal(theme(undefined), null);
      assert.equal(resolvePageAmbientTheme(null, null), null);
    });

    test("a banner themes the page on its own", () => {
      assert.deepEqual(theme(undefined, { banner: BANNER as any }), {
        image: BANNER,
        tintGlobals: true,
      });
    });

    test("a video poster alone does not theme the page", () => {
      assert.equal(theme(undefined, { poster: POSTER as any }), null);
      assert.equal(
        theme(undefined, { banner: BANNER as any, poster: POSTER as any }),
        null,
      );
    });

    test("ambient: true uses the banner, then the poster", () => {
      assert.deepEqual(
        theme(true, { banner: BANNER as any, poster: POSTER as any }),
        {
          image: BANNER,
          tintGlobals: true,
        },
      );
      assert.deepEqual(theme(true, { poster: POSTER as any }), {
        image: POSTER,
        tintGlobals: true,
      });
    });

    test("a string is the image", () => {
      assert.deepEqual(theme("/art.png", { banner: BANNER as any }), {
        image: "/art.png",
        tintGlobals: true,
      });
    });

    test("an object is the theme config; its image defaults to the banner", () => {
      assert.deepEqual(
        theme({ tintGlobals: false }, { banner: BANNER as any }),
        {
          image: BANNER,
          tintGlobals: false,
        },
      );
      assert.deepEqual(
        theme({ image: "/own.png" }, { banner: BANNER as any }),
        {
          image: "/own.png",
        },
      );
    });

    test("ambient: false turns off the automatic banner theme", () => {
      assert.equal(theme(false, { banner: BANNER as any }), null);
    });
  });
});
