import { useState } from 'react';
import Layout from '../components/layout/Layout';
import DocumentList from '../components/DocumentList';
import DocumentUpload from '../components/DocumentUpload';
import '../styles/Documents.css';

const Documents = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUpload, setShowUpload] = useState(false);

  const handleUploadSuccess = () => {
    setShowUpload(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Layout>
      <div className="documents-container">
        <div className="documents-header">
          <h1>Documents</h1>
          <button className="btn-primary" onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? 'Cancel' : '+ Upload Document'}
          </button>
        </div>

        {showUpload && (
          <div className="upload-section">
            <DocumentUpload
              onSuccess={handleUploadSuccess}
              onCancel={() => setShowUpload(false)}
            />
          </div>
        )}

        <div className="documents-content">
          <DocumentList key={refreshKey} />
        </div>
      </div>
    </Layout>
  );
};

export default Documents;
