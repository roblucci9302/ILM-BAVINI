/**
 * Service de gestion des templates de projet
 * Permet de charger et afficher les templates disponibles pour un démarrage rapide
 */

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  prompt: string;
}

/**
 * Liste des templates disponibles pour le démarrage rapide
 * Chaque template génère un projet TypeScript avec tests Vitest
 */
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'react-vite-ts',
    name: 'React',
    description: 'Application React + TypeScript + Vite + Vitest',
    icon: '⚛️',
    color: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30',
    prompt: 'Crée une application React avec TypeScript, Vite, et Vitest pour les tests. Inclure un composant App de base avec un test.',
  },
  {
    id: 'node-ts',
    name: 'Node.js',
    description: 'Serveur Node.js + TypeScript + Vitest',
    icon: '🟢',
    color: 'bg-green-500/10 hover:bg-green-500/20 border-green-500/30',
    prompt: 'Crée un projet Node.js avec TypeScript et Vitest pour les tests. Inclure un point d\'entrée index.ts et un module utilitaire avec tests.',
  },
  {
    id: 'next-ts',
    name: 'Next.js',
    description: 'Application Next.js 14 + TypeScript + App Router',
    icon: '▲',
    color: 'bg-gray-500/10 hover:bg-gray-500/20 border-gray-500/30',
    prompt: 'Crée une application Next.js 14 avec TypeScript et App Router. Inclure une page d\'accueil, un layout, et la configuration de tests avec Vitest.',
  },
  {
    id: 'astro-ts',
    name: 'Astro',
    description: 'Site Astro + TypeScript + Islands',
    icon: '🚀',
    color: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30',
    prompt: 'Crée un site Astro avec TypeScript. Inclure une page d\'accueil, un composant interactif React, et la configuration de tests.',
  },
  {
    id: 'express-ts',
    name: 'API Express',
    description: 'API REST Express + TypeScript + Vitest',
    icon: '🔌',
    color: 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30',
    prompt: 'Crée une API REST avec Express et TypeScript. Inclure un endpoint /health, la structure MVC, et des tests avec Vitest et Supertest.',
  },
];

/**
 * Récupère un template par son identifiant
 */
export function getTemplateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((template) => template.id === id);
}

/**
 * Récupère les templates principaux à afficher (les 4 premiers)
 */
export function getMainTemplates(): ProjectTemplate[] {
  return PROJECT_TEMPLATES.slice(0, 4);
}

/**
 * Récupère les templates additionnels (après les 4 premiers)
 */
export function getAdditionalTemplates(): ProjectTemplate[] {
  return PROJECT_TEMPLATES.slice(4);
}
