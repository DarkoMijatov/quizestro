/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'

const SITE_NAME = "Quizestro"

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="sr" dir="ltr">
    <Head />
    <Preview>Resetujte lozinku za {siteName || SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>🏆 {siteName || SITE_NAME}</Text>
        <Hr style={hr} />
        <Heading style={h1}>Resetovanje lozinke</Heading>
        <Text style={text}>
          Primili smo zahtev za resetovanje vaše lozinke na platformi {siteName || SITE_NAME}.
          Kliknite na dugme ispod da izaberete novu lozinku.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Resetuj lozinku
        </Button>
        <Text style={hint}>
          Ako niste zatražili resetovanje lozinke, možete slobodno ignorisati ovaj email.
          Vaša lozinka neće biti promenjena.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>© {new Date().getFullYear()} {siteName || SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { fontSize: '20px', fontWeight: '700' as const, color: '#e69500', margin: '0 0 16px' }
const hr = { borderColor: '#e4e4e7', margin: '24px 0' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1a1a2e', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3f3f46', lineHeight: '1.6', margin: '0 0 20px' }
const button = {
  backgroundColor: '#e69500',
  color: '#1a1a2e',
  padding: '12px 32px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: '700' as const,
  fontSize: '15px',
  display: 'inline-block' as const,
}
const hint = { fontSize: '13px', color: '#a1a1aa', lineHeight: '1.5', margin: '24px 0 0' }
const footer = { fontSize: '12px', color: '#a1a1aa', textAlign: 'center' as const, margin: '0' }
