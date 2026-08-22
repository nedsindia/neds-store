import React from "react";
import { useLocalSearchParams } from "expo-router";
import ProductsPage from "../products";

export default function CategoryPage() {
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  // Reuse the catalogue implementation so category browsing shares the same
  // API, sorting, cards and responsive behavior without duplicating business logic.
  return <ProductsPage key={`${id}-${name}`} />;
}
