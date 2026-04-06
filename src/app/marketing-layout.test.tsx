/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DownloadPage from '@/app/download/page'
import PricingPage from '@/app/pricing/page'
import PrivacyPage from '@/app/privacy/page'
import TermsPage from '@/app/terms/page'
import LoginPage from '@/app/login/page'

vi.mock('@/lib/desktop-release', () => ({
  fetchDesktopReleaseInfo: async () => ({ latestVersion: 'test-version' }),
}))
vi.mock('@/components/NavControls', () => ({
  ThemeToggle: () => <button type="button">theme</button>,
}))

describe('marketing page layout consistency', () => {
  it('keeps footer pinned to viewport bottom with shared flex column shell', async () => {
    const downloadUi = await DownloadPage()
    const { container: downloadContainer, unmount: unmountDownload } = render(downloadUi)
    expect(downloadContainer.firstElementChild?.className).toContain('flex')
    expect(downloadContainer.firstElementChild?.className).toContain('flex-col')
    expect(downloadContainer.querySelector('main')?.className).toContain('flex-1')
    unmountDownload()

    const pricingContainer = render(<PricingPage />).container
    expect(pricingContainer.firstElementChild?.className).toContain('flex')
    expect(pricingContainer.firstElementChild?.className).toContain('flex-col')
    expect(pricingContainer.querySelector('main')?.className).toContain('flex-1')

    const privacyUi = PrivacyPage()
    const { container: privacyContainer, unmount: unmountPrivacy } = render(privacyUi)
    expect(privacyContainer.firstElementChild?.className).toContain('flex')
    expect(privacyContainer.firstElementChild?.className).toContain('flex-col')
    expect(privacyContainer.querySelector('main')?.className).toContain('flex-1')
    unmountPrivacy()

    const termsUi = TermsPage()
    const { container: termsContainer } = render(termsUi)
    expect(termsContainer.firstElementChild?.className).toContain('flex')
    expect(termsContainer.firstElementChild?.className).toContain('flex-col')
    expect(termsContainer.querySelector('main')?.className).toContain('flex-1')
  })

  it('uses centered single login panel with title and button together', () => {
    const { container } = render(<LoginPage />)

    expect(container.querySelector('main.layout-shell.flex-1')).toBeTruthy()
    expect(container.querySelector('main.layout-grid-2')).toBeFalsy()
    expect(container.querySelector('[data-testid="login-panel"]')).toBeTruthy()
    expect(screen.getByText('Tastileにログイン')).toBeTruthy()
    expect(screen.getByText('タスク実行を、自動で最適化')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Googleでログイン/i })).toBeTruthy()
  })
})
