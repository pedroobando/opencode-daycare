import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'react-email';
import type { InvitationEmailProps } from '@/lib/email/types';

const COLORS = {
  background: '#F6ECDF',
  card: '#FFFDF9',
  cardBorder: '#ECE0D0',
  foreground: '#3F362E',
  muted: '#6E6359',
  gradientStart: '#F4977E',
  gradientEnd: '#EE8164',
  codeBg: '#FBF1D6',
  codeText: '#8A7234',
} as const;

const FONTS = {
  display: "'Fredoka', system-ui, -apple-system, sans-serif",
  sans: "'Nunito', system-ui, -apple-system, sans-serif",
  mono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
} as const;

export const InvitationEmail = ({
  parentName,
  childName,
  daycareName,
  code,
  activationUrl,
  expiresAt,
}: InvitationEmailProps) => {
  return (
    <Html lang="es">
      <Head>
        <Font
          fontFamily="Nunito"
          fallbackFontFamily={['Arial', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTQ3j6zbXWjgeg.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Fredoka"
          fallbackFontFamily={['Verdana', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/fredoka/v15/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3IcJfO-YpZWWvyM4w.woff2',
            format: 'woff2',
          }}
          fontWeight={500}
          fontStyle="normal"
        />
      </Head>
      <Preview>
        {`${parentName}, te invitamos a seguir el día a día de ${childName} en ${daycareName}`}
      </Preview>
      <Body
        style={{
          backgroundColor: COLORS.background,
          fontFamily: FONTS.sans,
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            backgroundColor: COLORS.card,
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: '24px',
            margin: '32px auto',
            maxWidth: '560px',
            padding: '40px 32px',
          }}
        >
          <Section>
            <div
              style={{
                background: `linear-gradient(135deg, ${COLORS.gradientStart}, ${COLORS.gradientEnd})`,
                borderRadius: '18px',
                color: '#FFFFFF',
                fontFamily: FONTS.display,
                fontSize: '22px',
                fontWeight: 600,
                margin: '0 auto 24px',
                padding: '20px',
                textAlign: 'center',
              }}
            >
              {daycareName}
            </div>
          </Section>

          <Heading
            as="h1"
            style={{
              color: COLORS.foreground,
              fontFamily: FONTS.display,
              fontSize: '28px',
              fontWeight: 600,
              lineHeight: '34px',
              margin: '0 0 12px',
              textAlign: 'left',
            }}
          >
            Hola, {parentName}
          </Heading>

          <Text
            style={{
              color: COLORS.muted,
              fontSize: '16px',
              lineHeight: '24px',
              margin: '0 0 24px',
            }}
          >
            Te invitaron a seguir el día a día de <strong>{childName}</strong> en{' '}
            {daycareName}. Para activar tu cuenta y empezar a ver las publicaciones,
            fotos y novedades, usá el siguiente código o hacé clic en el botón.
          </Text>

          <Section
            style={{
              backgroundColor: COLORS.codeBg,
              borderRadius: '16px',
              margin: '0 0 24px',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <Text
              style={{
                color: COLORS.codeText,
                fontFamily: FONTS.sans,
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.18em',
                margin: '0 0 8px',
                textTransform: 'uppercase',
              }}
            >
              Tu código de invitación
            </Text>
            <Text
              style={{
                color: COLORS.codeText,
                fontFamily: FONTS.mono,
                fontSize: '32px',
                fontWeight: 700,
                letterSpacing: '0.2em',
                margin: 0,
              }}
            >
              {code}
            </Text>
          </Section>

          <Section style={{ margin: '0 0 24px', textAlign: 'center' }}>
            <Button
              href={activationUrl}
              style={{
                background: `linear-gradient(180deg, ${COLORS.gradientStart}, ${COLORS.gradientEnd})`,
                borderRadius: '15px',
                boxShadow: '0 10px 22px -8px rgba(238, 129, 100, 0.7)',
                boxSizing: 'border-box',
                color: '#FFFFFF',
                display: 'inline-block',
                fontFamily: FONTS.sans,
                fontSize: '16px',
                fontWeight: 800,
                padding: '14px 28px',
                textDecoration: 'none',
              }}
            >
              Activar mi cuenta
            </Button>
          </Section>

          <Text
            style={{
              color: COLORS.muted,
              fontSize: '14px',
              lineHeight: '20px',
              margin: 0,
              textAlign: 'center',
            }}
          >
            Este código vence el {expiresAt}.
          </Text>
        </Container>

        <Text
          style={{
            color: COLORS.muted,
            fontSize: '12px',
            lineHeight: '18px',
            margin: '0 auto 32px',
            maxWidth: '560px',
            padding: '0 32px',
            textAlign: 'center',
          }}
        >
          Si no esperabas este email, podés ignorarlo.
        </Text>
      </Body>
    </Html>
  );
};

export default InvitationEmail;
