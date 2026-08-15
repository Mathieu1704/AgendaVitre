import React, { useEffect, useState } from "react";
import { View, Text, Image } from "react-native";
import { cn } from "../cn";

export function Avatar({
  name,
  size = "md",
  className,
  color,
  imageUrl,
}: {
  name: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
  color?: string;
  imageUrl?: string | null;
}) {
  // Les URLs (signées, bucket privé) expirent — si le chargement échoue, on
  // retombe sur les initiales plutôt que d'afficher une bulle cassée.
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageUrl]);

  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  if (imageUrl && !imageFailed) {
    return (
      <View
        className={cn("rounded-full overflow-hidden", sizeClasses[size], className)}
      >
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      </View>
    );
  }

  return (
    <View
      className={cn(
        "rounded-full items-center justify-center",
        !color && "bg-primary",
        sizeClasses[size],
        className
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      <Text className={cn("font-bold text-white", textSizes[size])}>
        {initials}
      </Text>
    </View>
  );
}
