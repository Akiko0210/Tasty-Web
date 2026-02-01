"use client";

import { OrdersView } from "@/components/OrdersView";
import { useApp } from "@/contexts/AppContext";

export default function OrdersPage() {
  const { orders, cancelOrder } = useApp();
  return <OrdersView orders={orders} onCancel={cancelOrder} />;
}
