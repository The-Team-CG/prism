/** @vitest-environment jsdom */
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthenticatorCodeInput } from "./authenticator-code-input";

afterEach(cleanup);

function CodeEntry() {
  const [code, setCode] = useState("");
  return (
    <>
      <label htmlFor="two-factor-code">Authenticator code</label>
      <AuthenticatorCodeInput value={code} onChange={setCode} />
    </>
  );
}

describe("authenticator code entry", () => {
  it("accepts autofill and edits as one numeric code, preserving leading zeroes", () => {
    render(<CodeEntry />);
    const input = screen.getByLabelText<HTMLInputElement>("Authenticator code");
    fireEvent.change(input, { target: { value: "012345" } });
    expect(input.value).toBe("012345");
    fireEvent.change(input, { target: { value: "01234" } });
    expect(input.value).toBe("01234");
    fireEvent.change(input, { target: { value: "01a234b567" } });
    expect(input.value).toBe("012345");
  });

  it("pastes a complete code with separators and ignores a paste with no digits", () => {
    render(<CodeEntry />);
    const input = screen.getByLabelText<HTMLInputElement>("Authenticator code");
    fireEvent.paste(input, { clipboardData: { getData: () => "012 345\n" } });
    expect(input.value).toBe("012345");
    fireEvent.paste(input, { clipboardData: { getData: () => "not a code" } });
    expect(input.value).toBe("012345");
  });
});
