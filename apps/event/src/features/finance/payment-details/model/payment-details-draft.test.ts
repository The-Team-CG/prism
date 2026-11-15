import { describe, expect, it } from "vitest";
import type { PaymentMethod } from "@prism/types";
import { changedAccountNumbers, isDirty, lastDigits, moveMethod, newMethod, removeMethod, saveProblem, setField } from "./payment-details-draft";

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const bpi: PaymentMethod = { kind: "bank", id: id(1), label: "BPI", accountName: "PMCM Events", accountNumber: "1234 5678 90", instructions: "", qrImageId: null, enabled: true };
const gcash: PaymentMethod = { kind: "ewallet", id: id(2), label: "GCash", accountName: "PMCM Finance", accountNumber: "0917 123 4567", instructions: "", qrImageId: "pqr_a", enabled: true };
const cheque: PaymentMethod = { kind: "cheque", id: id(3), label: "Cheque", accountName: "PMCM Events", instructions: "", enabled: true };

describe("payment details draft", () => {
  it("starts each kind empty and on, and a cheque never gets an account number or QR", () => {
    expect(newMethod("bank", id(9))).toMatchObject({ kind: "bank", label: "Bank transfer", accountNumber: "", qrImageId: null, enabled: true });
    expect(newMethod("ewallet", id(9))).toMatchObject({ kind: "ewallet", label: "GCash" });
    expect(newMethod("cheque", id(9))).not.toHaveProperty("accountNumber");
    expect(setField([cheque], id(3), "accountNumber", "123")[0]).toEqual(cheque);
    expect(setField([cheque], id(3), "qrImageId", "pqr_x")[0]).toEqual(cheque);
    expect(setField([bpi, gcash], id(2), "qrImageId", null)[1]).toMatchObject({ qrImageId: null });
  });

  it("moves a method one place, stays put at either end, and removes by id", () => {
    expect(moveMethod([bpi, gcash, cheque], id(2), -1).map((method) => method.id)).toEqual([id(2), id(1), id(3)]);
    expect(moveMethod([bpi, gcash, cheque], id(1), -1)).toEqual([bpi, gcash, cheque]);
    expect(moveMethod([bpi, gcash, cheque], id(3), 1)).toEqual([bpi, gcash, cheque]);
    expect(removeMethod([bpi, gcash], id(1))).toEqual([gcash]);
    expect(isDirty([bpi], [bpi])).toBe(false);
    expect(isDirty([bpi], [{ ...bpi, label: "BPI Savings" }])).toBe(true);
  });

  it("says what is missing before a save, by method, and why a list as a whole cannot be saved", () => {
    expect(saveProblem([bpi, gcash, cheque])).toBeNull();
    expect(saveProblem([])).toBeNull();
    expect(saveProblem([{ ...bpi, accountNumber: " " }])).toBe("BPI: Enter the account number.");
    expect(saveProblem([{ ...cheque, accountName: "" }])).toBe("Cheque: Enter who the cheque is payable to.");
    expect(saveProblem([{ ...bpi, enabled: false }, { ...gcash, enabled: false }])).toBe("Keep at least one payment method turned on");
  });

  it("names only existing methods whose account number is changing, ignoring spacing", () => {
    expect(changedAccountNumbers([bpi, gcash], [{ ...bpi, accountNumber: "9999" }, gcash, newMethod("bank", id(4))])).toEqual(["BPI"]);
    expect(changedAccountNumbers([bpi], [{ ...bpi, accountNumber: " 1234 5678 90 " }])).toEqual([]);
    expect(lastDigits(bpi)).toBe("7890");
    expect(lastDigits({ ...bpi, accountNumber: "1234-5678-90" })).toBe("7890");
    expect(lastDigits(cheque)).toBe("");
  });
});
