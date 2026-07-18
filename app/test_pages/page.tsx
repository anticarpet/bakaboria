"use client";

import React, { useState } from 'react';


interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
}

/**
 * Extracts folder ID from a Google Drive link and fetches its file links.
 * @param folderUrl - The full Google Drive folder URL
 * @param apiKey - Your Google Cloud API Key (with Drive API enabled)
 * @returns Array of direct web view links for the files
 */
export const getDriveFileLinks = async (folderUrl: string, apiKey: string): Promise<string[]> => {
  // 1. Extract the folder ID using regex
  const match = folderUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error("Invalid Google Drive folder URL structure.");
  }
  const folderId = match[1];

  // 2. Query the Google Drive API v3
  // We filter by 'parents' to get files inside this folder, and request 'webViewLink'
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,webViewLink)&key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to fetch files from Google Drive.");
  }

  const data = await response.json();
  const files: DriveFile[] = data.files || [];

  // 3. Return just the array of file links
  return files.map(file => file.webViewLink);
};

const API_KEY = "YOUR_GOOGLE_API_KEY"; // Best kept in a .env file

export default function FolderLinkExtractor() {
  const [folderUrl, setFolderUrl] = useState('');
  const [fileLinks, setFileLinks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const links = await getDriveFileLinks(folderUrl, API_KEY);
      setFileLinks(links);
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setFileLinks([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <form onSubmit={handleFetchFiles}>
        <input
          type="text"
          placeholder="Paste Google Drive Folder Link"
          value={folderUrl}
          onChange={(e) => setFolderUrl(e.target.value)}
          style={{ width: '80%', padding: '8px', marginRight: '8px' }}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Fetching...' : 'Get Links'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {fileLinks.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>File Links:</h3>
          <ul>
            {fileLinks.map((link, index) => (
              <li key={index}>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};