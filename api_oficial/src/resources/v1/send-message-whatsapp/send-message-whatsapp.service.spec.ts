import { SendMessageWhatsappService } from './send-message-whatsapp.service';

describe('SendMessageWhatsappService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('converts template media link into Meta media id before sending', async () => {
    const metaServiceMock = {
      uploadMedia: jest.fn().mockResolvedValue('media-id-123'),
      sendMessage: jest.fn().mockResolvedValue({
        messages: [{ id: 'wamid.123' }],
      }),
    };

    const service = new SendMessageWhatsappService(
      metaServiceMock as any,
      {} as any,
    );

    (service as any).prisma = {
      whatsappOficial: {
        findFirst: jest.fn().mockResolvedValue({
          id: 9,
          phone_number_id: '770260399509351',
          send_token: 'send-token',
          companyId: 1,
        }),
      },
      company: {
        findFirst: jest.fn().mockResolvedValue({ id: 1 }),
      },
      sendMessageWhatsApp: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };

    const payload = {
      to: '5511999999999',
      type: 'template',
      body_template: {
        name: 'teste_4576',
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: {
                  link: 'https://example.com/banner.jpg',
                },
              },
            ],
          },
        ],
      },
    };

    await service.createMessage('connection-token', JSON.stringify(payload), null);

    expect(metaServiceMock.uploadMedia).toHaveBeenCalledWith(
      '770260399509351',
      'send-token',
      'https://example.com/banner.jpg',
    );

    expect(metaServiceMock.sendMessage).toHaveBeenCalledWith(
      '770260399509351',
      'send-token',
      expect.objectContaining({
        template: expect.objectContaining({
          components: [
            expect.objectContaining({
              parameters: [
                expect.objectContaining({
                  type: 'image',
                  image: { id: 'media-id-123' },
                }),
              ],
            }),
          ],
        }),
      }),
    );
  });

  it('does not upload media for plain text messages with urls', async () => {
    const metaServiceMock = {
      uploadMedia: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue({
        messages: [{ id: 'wamid.456' }],
      }),
    };

    const service = new SendMessageWhatsappService(
      metaServiceMock as any,
      {} as any,
    );

    (service as any).prisma = {
      whatsappOficial: {
        findFirst: jest.fn().mockResolvedValue({
          id: 9,
          phone_number_id: '770260399509351',
          send_token: 'send-token',
          companyId: 1,
        }),
      },
      company: {
        findFirst: jest.fn().mockResolvedValue({ id: 1 }),
      },
      sendMessageWhatsApp: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };

    const payload = {
      to: '5511999999999',
      type: 'text',
      body_text: {
        body: 'Veja http://app.c4life.com.br e www.c4life.com.br',
      },
    };

    await service.createMessage('connection-token', JSON.stringify(payload), null);

    expect(metaServiceMock.uploadMedia).not.toHaveBeenCalled();
    expect(metaServiceMock.sendMessage).toHaveBeenCalledWith(
      '770260399509351',
      'send-token',
      expect.objectContaining({
        text: {
          body: 'Veja http://app.c4life.com.br e www.c4life.com.br',
          preview_url: undefined,
        },
      }),
    );
  });
});
