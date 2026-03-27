/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'

const SITE_NAME = "Quizestro"

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="sr" dir="ltr">
    <Head />
    <Preview>Vaš verifikacioni kod za {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>🏆 {SITE_NAME}</Text>
        <Hr style={hr} />
        <Heading style={h1}>Potvrda identiteta</Heading>
        <Text style={text}>Koristite kod ispod da potvrdite svoj identitet:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={hint}>
          Ovaj kod ističe uskoro. Ako niste zatražili ovaj kod, možete slobodno ignorisati ovaj email.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>© {new Date().getFullYear()} {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { fontSize: '20px', fontWeight: '700' as const, color: '#e69500', margin: '0 0 16px' }
const hr = { borderColor: '#e4e4e7', margin: '24px 0' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1a1a2e', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3f3f46', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: '700' as const,
  color: '#e69500',
  margin: '0 0 30px',
  letterSpacing: '4px',
}
const hint = { fontSize: '13px', color: '#a1a1aa', lineHeight: '1.5', margin: '24px 0 0' }
const footer = { fontSize: '12px', color: '#a1a1aa', textAlign: 'center' as const, margin: '0' }
