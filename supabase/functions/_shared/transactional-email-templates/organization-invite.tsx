import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Quizestro"

interface OrganizationInviteProps {
  organizationName?: string
  inviteUrl?: string
}

const OrganizationInviteEmail = ({ organizationName, inviteUrl }: OrganizationInviteProps) => (
  <Html lang="sr" dir="ltr">
    <Head />
    <Preview>Pozvani ste u {organizationName || 'organizaciju'} na {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>🏆 {SITE_NAME}</Text>
        <Hr style={hr} />
        <Heading style={h1}>
          Pozvani ste u {organizationName || 'organizaciju'}!
        </Heading>
        <Text style={text}>
          Dobili ste pozivnicu da se pridružite organizaciji <strong>{organizationName}</strong> na platformi {SITE_NAME}.
        </Text>
        {inviteUrl && (
          <Button style={button} href={inviteUrl}>
            Prihvati pozivnicu
          </Button>
        )}
        <Text style={hint}>
          Ako nemate nalog, registrujte se koristeći email adresu na koju ste primili ovu poruku i automatski ćete biti dodati u organizaciju.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>© {new Date().getFullYear()} {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrganizationInviteEmail,
  subject: (data: Record<string, any>) =>
    `Pozivnica za ${data.organizationName || 'organizaciju'} na ${SITE_NAME}`,
  displayName: 'Organization invite',
  previewData: { organizationName: 'Quiz Masters', inviteUrl: 'https://quizestro.com/register' },
} satisfies TemplateEntry

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
