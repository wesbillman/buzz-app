// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WindowControls } from "./WindowControls";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(),
  invoke: vi.fn().mockResolvedValue(true),
}));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(invoke).mockResolvedValue(true);
});

it.each([
  [false, "Linux x86_64"],
  [false, "Win32"],
  [true, "MacIntel"],
  [true, "Darwin"],
])(
  "does not render outside native Linux or Windows (%s, %s)",
  (native, platform) => {
    vi.mocked(isTauri).mockReturnValue(native);
    vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
    render(<WindowControls />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(getCurrentWindow).not.toHaveBeenCalled();
  },
);

it.each(["Linux x86_64", "Win32"])(
  "supports keyboard window actions and retry on %s",
  async (platform) => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
    const minimize = vi
      .fn()
      .mockRejectedValueOnce(new Error("denied"))
      .mockResolvedValue(undefined);
    const toggleMaximize = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getCurrentWindow).mockReturnValue({
      minimize,
      toggleMaximize,
      close,
    } as unknown as ReturnType<typeof getCurrentWindow>);
    const user = userEvent.setup();
    render(<WindowControls />);
    await screen.findByRole("button", { name: "Minimize window" });
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Minimize window" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Window action failed",
    );
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.tab();
    await user.keyboard("{Enter}");
    await user.tab();
    await user.keyboard(" ");
    expect(minimize).toHaveBeenCalledTimes(2);
    expect(toggleMaximize).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  },
);

it("omits minimize on Hyprland while retaining maximize and close", async () => {
  vi.mocked(isTauri).mockReturnValue(true);
  vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
  let resolve!: (value: boolean) => void;
  const support = new Promise<boolean>((done) => {
    resolve = done;
  });
  vi.mocked(invoke).mockReturnValue(support);
  const toggleMaximize = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn().mockResolvedValue(undefined);
  const minimize = vi.fn();
  vi.mocked(getCurrentWindow).mockReturnValue({
    minimize,
    toggleMaximize,
    close,
  } as unknown as ReturnType<typeof getCurrentWindow>);
  const user = userEvent.setup();
  render(<WindowControls />);
  try {
    expect(invoke).toHaveBeenCalledWith("window_can_minimize");
    expect(
      screen.queryByRole("button", { name: "Minimize window" }),
    ).toBeNull();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Maximize or restore window" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.tab();
    await user.keyboard("{Enter}");
    expect(toggleMaximize).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(minimize).not.toHaveBeenCalled();
  } finally {
    await act(async () => resolve(false));
  }
  expect(screen.queryByRole("button", { name: "Minimize window" })).toBeNull();
});

it("keeps other controls available if the native support check fails", async () => {
  vi.mocked(isTauri).mockReturnValue(true);
  vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
  vi.mocked(invoke).mockRejectedValue(new Error("unavailable"));
  render(<WindowControls />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not determine minimize support",
  );
  expect(screen.queryByRole("button", { name: "Minimize window" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Maximize or restore window" }),
  ).toBeEnabled();
  expect(screen.getByRole("button", { name: "Close window" })).toBeEnabled();
});
