import { describe, it, expect } from "vitest";
import { validateMediaFile, DEFAULT_MAX_PHOTO_MB, DEFAULT_MAX_VIDEO_MB } from "./pet-media-limits";

const limits = {
  maxPhotoBytes: DEFAULT_MAX_PHOTO_MB * 1024 * 1024,
  maxVideoBytes: DEFAULT_MAX_VIDEO_MB * 1024 * 1024,
};

describe("validateMediaFile", () => {
  it("aceita foto dentro do limite", () => {
    expect(validateMediaFile({ type: "image/jpeg", size: limits.maxPhotoBytes - 1 }, limits)).toBeNull();
  });

  it("rejeita foto acima do limite", () => {
    expect(validateMediaFile({ type: "image/jpeg", size: limits.maxPhotoBytes + 1 }, limits)).toContain("grande");
  });

  it("rejeita formato de imagem não aceito", () => {
    expect(validateMediaFile({ type: "image/gif", size: 1000 }, limits)).toContain("Formato");
  });

  it("aceita vídeo dentro do limite", () => {
    expect(validateMediaFile({ type: "video/mp4", size: limits.maxVideoBytes - 1 }, limits)).toBeNull();
  });

  it("rejeita vídeo acima do limite", () => {
    expect(validateMediaFile({ type: "video/mp4", size: limits.maxVideoBytes + 1 }, limits)).toContain("grande");
  });

  it("rejeita formato de vídeo não aceito", () => {
    expect(validateMediaFile({ type: "video/avi", size: 1000 }, limits)).toContain("Formato");
  });

  it("rejeita tipo que não é nem imagem nem vídeo", () => {
    expect(validateMediaFile({ type: "application/pdf", size: 1000 }, limits)).toContain("foto ou vídeo");
  });

  it("respeita limites customizados (não fica preso ao default)", () => {
    const customLimits = { maxPhotoBytes: 2 * 1024 * 1024, maxVideoBytes: 10 * 1024 * 1024 };
    expect(validateMediaFile({ type: "image/jpeg", size: 1.5 * 1024 * 1024 }, customLimits)).toBeNull();
    expect(validateMediaFile({ type: "image/jpeg", size: 1.5 * 1024 * 1024 }, limits)).toContain("grande");
  });
});
