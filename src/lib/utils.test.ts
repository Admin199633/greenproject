describe("utils", () => {
  it("formats am/pm event times to 24-hour format", async () => {
    const { formatEventTime } = await import("@/lib/utils");

    expect(formatEventTime("1:00 AM")).toBe("01:00");
    expect(formatEventTime("1:00 PM")).toBe("13:00");
    expect(formatEventTime("6:30 PM")).toBe("18:30");
  });

  it("keeps existing 24-hour event times normalized", async () => {
    const { formatEventTime } = await import("@/lib/utils");

    expect(formatEventTime("1:00")).toBe("01:00");
    expect(formatEventTime("13:00")).toBe("13:00");
  });
});
