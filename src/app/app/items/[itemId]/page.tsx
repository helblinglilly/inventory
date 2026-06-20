import { ItemEditor } from "@/components/item-editor";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;

  return <ItemEditor itemId={itemId} />;
}
