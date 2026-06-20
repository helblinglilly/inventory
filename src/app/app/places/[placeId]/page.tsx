import { PlaceDetailPage } from "@/components/place-detail-page";

export default async function PlacePage({
  params,
}: {
  params: Promise<{ placeId: string }>;
}) {
  const { placeId } = await params;

  return <PlaceDetailPage placeId={placeId} />;
}
