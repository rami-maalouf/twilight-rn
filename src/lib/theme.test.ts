import { getTheme } from "./theme";
test("system follows the supplied device appearance for both palettes", () => {
  for (const colorPalette of ["Twilight", "Amethyst"] as const) {
    const appearance = { themeMode: "System" as const, colorPalette };
    expect(getTheme(appearance, "light").textPrimary).not.toBe(
      getTheme(appearance, "dark").textPrimary,
    );
    expect(getTheme(appearance, "light")).toEqual(
      getTheme({ ...appearance, themeMode: "Sunset" }, "dark"),
    );
  }
});
