import { motion } from "framer-motion";

export default function LikeButton() {
  return (
    <motion.button
      className="like"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      Like
    </motion.button>
  );
}
