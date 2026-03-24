class FormatMask {
  setPhoneFormatMask(phoneToFormat) {
    if (phoneToFormat === null || phoneToFormat === undefined) {
      return phoneToFormat;
    }

    const number = String(phoneToFormat).replace(/\D/g, "");

    if (number.length === 12) {
      const phoneNumberFormatted = number.match(/^(\d{2})(\d{2})(\d{4})(\d{4})$/);
      if (!phoneNumberFormatted) {
        return phoneToFormat;
      }

      return (
        "+" +
        phoneNumberFormatted[1] +
        " (" +
        phoneNumberFormatted[2] +
        ") " +
        phoneNumberFormatted[3] +
        "-" +
        phoneNumberFormatted[4]
      );
    }

    if (number.length === 13) {
      const phoneNumberFormatted = number.match(/^(\d{2})(\d{2})(\d{5})(\d{4})$/);
      if (!phoneNumberFormatted) {
        return phoneToFormat;
      }

      return (
        "+" +
        phoneNumberFormatted[1] +
        " (" +
        phoneNumberFormatted[2] +
        ") " +
        phoneNumberFormatted[3] +
        "-" +
        phoneNumberFormatted[4]
      );
    }

    return phoneToFormat;
  }

  removeMask(number) {
    const filterNumber = number.replace(/\D/g, "");
    return filterNumber;
  }

  maskPhonePattern(phoneNumber) {
    const brFlag = "\u{1F1E7}\u{1F1F7}";

    if (phoneNumber.length < 13) {
      return `${brFlag} (99) 9999 9999`;
    }

    return `${brFlag} (99) 99999 9999`;
  }
}

export { FormatMask };
