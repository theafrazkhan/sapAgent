import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Smart Factory — Operations workspace',description:'Explore SAP manufacturing exports and investigate the evidence.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
