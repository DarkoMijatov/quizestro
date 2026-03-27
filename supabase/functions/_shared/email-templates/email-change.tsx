/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'

const SITE_NAME = "Quizestro"

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="sr" dir="ltr">
    <Head />
    <Preview>Potvrdite promenu email adrese za {siteName || SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>🏆 {siteName || SITE_NAME}</Text>
        <Hr style={hr} />
        <Heading style={h1}>Potvrda promene email adrese</Heading>
        <Text style={text}>
          Zatražili ste promenu email adrese za {siteName || SITE_NAME} sa{' '}
          <Link href={`mailto:${email}`} style={link}>{email}</Link>{' '}
          na{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>
          Kliknite na dugme ispod da potvrdite ovu promenu:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Potvrdi promenu
        </Button>
        <Text style={hint}>
          Ako niste zatražili ovu promenu, odmah obezbedite svoj nalog.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>© {new Date().getFullYear()} {siteName || SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { fontSize: '20px', fontWeight: '700' as const, color: '#e69500', margin: '0 0 16px' }
const hr = { borderColor: '#e4e4e7', margin: '24px 0' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1a1a2e', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3f3f46', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: 'inherit', textDecoration: 'underline' }
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
