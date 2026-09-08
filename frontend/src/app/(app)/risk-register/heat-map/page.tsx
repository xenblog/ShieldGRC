import { redirect } from 'next/navigation';

// The Heat Map now renders as a section of the Risk Register page itself
// (one screen, not two pages) - see /risk-register/page.tsx. This route is
// kept only so old links/bookmarks still land somewhere useful.
export default function HeatMapRedirect() {
  redirect('/risk-register');
}
