import { FormatMask } from "./FormatMask";

const formatSerializedId = (serializedId) => {
  if (serializedId === null || serializedId === undefined) {
    return serializedId;
  }

  const formatMask = new FormatMask();
  const number = String(serializedId).replace("@c.us", "");
  const formattedNumber = formatMask.setPhoneFormatMask(number);

  return formattedNumber?.replace("+55", "\u{1F1E7}\u{1F1F7}");
};

export default formatSerializedId;
