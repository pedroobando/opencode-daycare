export type PostType = "achievement" | "activity" | "announcement";

export interface Post {
  id: string;
  type: PostType;
  author: {
    name: string;
    initial: string;
    color: string;
  };
  recipientLabel: string;
  content: string;
  time: string;
  publishedBy: string;
  likes: number;
  comments: number;
  photo?: {
    alt: string;
  };
}

export const posts: Post[] = [
  {
    id: "post-1",
    type: "achievement",
    author: {
      name: "Mateo",
      initial: "M",
      color: "#A9D9E8",
    },
    recipientLabel: "familia de Mateo",
    content:
      "¡Usó el orinal solito por primera vez! Estaba feliz de contárselo a todos. Un gran paso.",
    time: "14:20",
    publishedBy: "publicado por vos",
    likes: 3,
    comments: 1,
  },
  {
    id: "post-2",
    type: "activity",
    author: {
      name: "Mateo",
      initial: "M",
      color: "#A9D9E8",
    },
    recipientLabel: "familia de Mateo",
    content:
      "Pintamos con témperas esta mañana. Mateo eligió el azul para todo y se concentró un montón mezclando colores.",
    time: "09:40",
    publishedBy: "publicado por vos",
    likes: 5,
    comments: 2,
    photo: {
      alt: "Foto · pintando con témperas",
    },
  },
  {
    id: "post-3",
    type: "announcement",
    author: {
      name: "Anuncio general",
      initial: "",
      color: "#CCD8F4",
    },
    recipientLabel: "toda la sala",
    content:
      "El viernes salimos al parque por la mañana. Recuerden mandar gorra y una botellita de agua.",
    time: "07:50",
    publishedBy: "publicado por vos",
    likes: 8,
    comments: 0,
  },
];
