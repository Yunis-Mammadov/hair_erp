const legacyPins = new Set(["2580", "2557", "2534"]);
function isLegacyPin(pin) { return legacyPins.has(pin); }
function assertPin(pin) {
  if (typeof pin !== "string" || !/^\d{4,8}$/.test(pin) || isLegacyPin(pin)) {
    throw Object.assign(new Error("PIN 4–8 rəqəm olmalıdır. 2580, 2557 və 2534 istifadə edilmir."), {
      status: 400, statusCode: 400, code: "PIN_POLICY",
    });
  }
  return pin;
}
module.exports = { assertPin, isLegacyPin };
