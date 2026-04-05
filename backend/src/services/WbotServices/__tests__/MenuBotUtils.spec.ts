import {
  classifyMenuInput,
  clearMenuMediaWarning,
  getMenuStageKey,
  shouldRunMenuBot,
  shouldSendMenuMediaWarning
} from "../MenuBotUtils";

describe("MenuBotUtils", () => {
  afterEach(() => {
    clearMenuMediaWarning(100);
  });

  describe("classifyMenuInput", () => {
    it("should classify media without text as media_no_text", () => {
      const result = classifyMenuInput({
        text: "",
        isMediaWithoutText: true
      });

      expect(result).toBe("media_no_text");
    });

    it("should classify media placeholders as media_no_text", () => {
      expect(
        classifyMenuInput({ text: "audio", isMediaWithoutText: true })
      ).toBe("media_no_text");
      expect(
        classifyMenuInput({ text: "sticker", isMediaWithoutText: true })
      ).toBe("media_no_text");
      expect(
        classifyMenuInput({ text: "documento", isMediaWithoutText: true })
      ).toBe("media_no_text");
    });

    it("should classify numeric options as valid_menu_input", () => {
      const result = classifyMenuInput({ text: "2" });
      expect(result).toBe("valid_menu_input");
    });

    it("should classify # and sair as valid_menu_input", () => {
      expect(classifyMenuInput({ text: "#" })).toBe("valid_menu_input");
      expect(classifyMenuInput({ text: "sair" })).toBe("valid_menu_input");
      expect(classifyMenuInput({ text: "Sair" })).toBe("valid_menu_input");
    });

    it("should classify non numeric text as invalid_text_input", () => {
      const result = classifyMenuInput({ text: "quero falar com alguém" });
      expect(result).toBe("invalid_text_input");
    });
  });

  describe("shouldRunMenuBot", () => {
    it("should run only when no attendant and has stage or queue options", () => {
      expect(
        shouldRunMenuBot({
          hasAttendant: false,
          hasStage: true,
          hasQueueOptions: false
        })
      ).toBe(true);

      expect(
        shouldRunMenuBot({
          hasAttendant: false,
          hasStage: false,
          hasQueueOptions: true
        })
      ).toBe(true);

      expect(
        shouldRunMenuBot({
          hasAttendant: true,
          hasStage: true,
          hasQueueOptions: true
        })
      ).toBe(false);
    });
  });

  describe("media warning one-time behavior", () => {
    it("should warn once per ticket+stage and allow warning on stage change", () => {
      const stageA = getMenuStageKey({
        channel: "baileys",
        queueId: 1,
        stageChatbotId: 10
      });
      const stageB = getMenuStageKey({
        channel: "baileys",
        queueId: 1,
        stageChatbotId: 11
      });

      expect(shouldSendMenuMediaWarning(100, stageA)).toBe(true);
      expect(shouldSendMenuMediaWarning(100, stageA)).toBe(false);
      expect(shouldSendMenuMediaWarning(100, stageB)).toBe(true);
    });
  });
});
