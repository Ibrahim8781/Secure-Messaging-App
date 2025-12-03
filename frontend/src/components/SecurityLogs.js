import React, { useState, useEffect } from 'react';
import api from '../services/api'; // Using your existing API instance
import './SecurityLogs.css';

const SecurityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/logs');
      setLogs(response.data.logs);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getLogStyle = (type) => {
    if (type.includes('FAIL') || type.includes('DETECTED') || type.includes('UNAUTHORIZED')) return 'type-danger';
    if (type.includes('SUCCESS') || type.includes('INITIATED') || type.includes('CONFIRMATION')) return 'type-success';
    return 'type-info';
  };

  return (
    <div className="logs-container">
      <div className="logs-header">
        <h3>🛡️ Security Audit Logs</h3>
        <button onClick={fetchLogs} className="refresh-btn" disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh Logs'}
        </button>
      </div>
      
      <div className="table-wrapper">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event Type</th>
              <th>User</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id}>
                <td style={{whiteSpace: 'nowrap'}}>
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td>
                  <span className={`log-type ${getLogStyle(log.eventType)}`}>
                    {log.eventType}
                  </span>
                </td>
                <td>{log.userId?.username || 'System/Anon'}</td>
                <td>
                  <span className="log-details" title={JSON.stringify(log.details, null, 2)}>
                    {JSON.stringify(log.details)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SecurityLogs;