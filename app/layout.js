export const metadata = {
  title: 'PixelPulse AI',
  description: 'Create stunning AI images in seconds',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
