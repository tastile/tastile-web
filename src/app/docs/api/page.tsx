import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Reference | Tastile',
  description: 'Tastile API reference documentation.',
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen">
      <script
        id="api-reference"
        type="application/json"
        data-url="/openapi.yaml"
      />
      <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference" />
    </div>
  )
}
