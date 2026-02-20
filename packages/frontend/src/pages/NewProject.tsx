import Layout from '../components/layout/Layout';
import ProjectForm from '../components/ProjectForm';
import '../styles/ProjectForm.css';

function NewProject() {
  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <h1>Create New Project</h1>
        </div>
        <ProjectForm />
      </div>
    </Layout>
  );
}

export default NewProject;
