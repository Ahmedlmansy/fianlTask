import React, { useState, useEffect, useRef } from 'react';
import { fetchTasks, updateTask } from './api.js';

const PRIORITY_WEIGHT = { Urgent: 3, High: 2, Medium: 1, Low: 0 };
const LOW_STOCK_LIMIT = 15;

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [isSearching, setIsSearching] = useState(false);

  const [countdown, setCountdown] = useState(5);
  const [saveCount, setSaveCount] = useState(0);
  const [lastSavedPayload, setLastSavedPayload] = useState(null);

  const [history, setHistory] = useState([]);
  const sortDirection = useRef("desc");

  const [notes, setNotes] = useState({});

  const handleNoteChange = (taskId, value) => {
    setNotes((prev) => ({ ...prev, [taskId]: value }));
  };
  // useRef to not Re-render
  const latest = useRef({ priorityFilter, selectedTaskIds });
  latest.current = { priorityFilter, selectedTaskIds };

  // user wait 300 ms to search
  useEffect(() => {
    let cancelled = false;
    setIsSearching(true);

    const timer = setTimeout(() => {
      fetchTasks(searchQuery, categoryFilter).then((results) => {
        if (cancelled) return;
        setTasks(results);
        setIsSearching(false);
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, categoryFilter]);
  useEffect(() => {
    setHistory([...history, { tasks, selectedTaskIds, at: Date.now() }]);
  }, [tasks, selectedTaskIds]);
// timer to 0
  useEffect(() => {
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, []);
// auto save when countdown to 0
  useEffect(() => {
    if (countdown > 0) return;

    setSaveCount((n) => n + 1);
    setLastSavedPayload({
      savedAt: new Date().toLocaleTimeString(),
      ...latest.current,
    });
    setCountdown(5);
  }, [countdown]);

  const handleUndo = () => {
    if (history.length < 2) return;
    const previous = history[history.length -1];
    setTasks(previous.tasks);
    setSelectedTaskIds(previous.selectedTaskIds);
    setHistory(history.slice(0, history.length - 1));
  };

  const handleSortByPriority = () => {
    sortDirection.current = sortDirection.current === "asc" ? "desc" : "asc";
    const dir = sortDirection.current === "asc" ? 1 : -1;

    setTasks((prev) =>
      [...prev].sort(
        (a, b) =>
          (PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]) * dir,
      ),
    );
  };

  const handleReverse = () => {
    setTasks((prev) => [...prev].reverse());
  };

  const handleToggleSelect = (taskId) => {
    if (selectedTaskIds.includes(taskId)) {
      setSelectedTaskIds(selectedTaskIds.filter((id) => id !== taskId));
    } else {
      setSelectedTaskIds([...selectedTaskIds, taskId]);
    }
  };

  const handleStockChange = (taskId, value) => {
    // error stock retrun string
    setTasks(
      tasks.map((t) =>
        t.id === taskId ? { ...t, stockUnits: parseInt(value) } : t,
      ),
    );
    updateTask(taskId, { stockUnits: parseInt(value) });
  };

  // Bulk retrun one complete
  const handleBulkComplete = () => {
    setTasks((prev) =>
      prev.map((t) =>
        selectedTaskIds.includes(t.id) ? { ...t, status: "Completed" } : t,
      ),
    );

    selectedTaskIds.forEach((id) => updateTask(id, { status: "Completed" }));
  };

  // Bulk retrun one restock
  const handleBulkRestock = () => {
    selectedTaskIds.forEach((id) => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return;
      const nextUnits = target.stockUnits + 10;
      setTasks(
        tasks.map((t) => (t.id === id ? { ...t, stockUnits: nextUnits } : t)),
      );
      updateTask(id, { stockUnits: nextUnits });
    });
  };

  const displayedTasks = tasks.filter(
    (task) => priorityFilter === "All" || task.priority === priorityFilter,
  );

  const totalUnits = displayedTasks.reduce((sum, t) => sum + t.stockUnits, 0);

  const lowStockCount = displayedTasks.filter(
    (t) => t.stockUnits < LOW_STOCK_LIMIT,
  ).length;
  const completedCount = displayedTasks.filter(
    (t) => t.status === "Completed",
  ).length;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Inventory &amp; Operations Dispatch</h1>
          <p className="muted">
            Warehouse maintenance schedules, restock audits and field units.
          </p>
        </div>
        <div className="actions">
          <button
            className="btn ghost"
            onClick={handleUndo}
            disabled={history.length < 2}
          >
            Undo ({Math.max(history.length - 1, 0)})
          </button>
          <button className="btn primary" onClick={handleSortByPriority}>
            Sort by Priority
          </button>
          <button className="btn primary" onClick={handleReverse}>
            Reverse Order
          </button>
        </div>
      </header>

      <section className="grid-3">
        <div className="card">
          <span className="label">Auto-save</span>
          <p className="big mono accent">
            Next auto-save in: {countdown} seconds
          </p>
          <span className="muted small">Saves completed: {saveCount}</span>
        </div>
        <div className="card span-2">
          <span className="label">Last Saved Payload</span>
          <pre className="payload mono">
            {lastSavedPayload
              ? JSON.stringify(lastSavedPayload, null, 2)
              : "Awaiting first auto-save..."}
          </pre>
        </div>
      </section>

      <section className="grid-4">
        <div className="card stat">
          <span className="label">Visible tasks</span>
          <p className="big">{displayedTasks.length}</p>
        </div>
        <div className="card stat">
          <span className="label">Total stock units</span>
          <p className="big">{totalUnits}</p>
        </div>
        <div className="card stat">
          <span className="label">Low stock items</span>
          <p className="big warn">{lowStockCount}</p>
        </div>
        <div className="card stat">
          <span className="label">Completed</span>
          <p className="big ok">{completedCount}</p>
        </div>
      </section>

      <section className="card toolbar">
        <div className="search">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or task code..."
          />
          {isSearching && <span className="querying">Querying...</span>}
        </div>
        <div className="filters">
          <label>
            Category
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All</option>
              <option value="Inventory">Inventory</option>
              <option value="Hardware">Hardware</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </label>
          <label>
            Priority
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="All">All</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>
        </div>
      </section>

      <section className="bulkbar">
        <span>
          <strong>{selectedTaskIds.length}</strong> selected
        </span>
        <div className="actions">
          <button
            className="btn ghost"
            onClick={handleBulkRestock}
            disabled={!selectedTaskIds.length}
          >
            Restock +10
          </button>
          <button
            className="btn ok"
            onClick={handleBulkComplete}
            disabled={!selectedTaskIds.length}
          >
            Mark Complete
          </button>
        </div>
      </section>

      <section className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th className="center">Select</th>
              <th>Task ID</th>
              <th>Operational Item</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Units</th>
              <th>Field Dispatch Notes</th>
            </tr>
          </thead>
          <tbody>
            {displayedTasks.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty">
                  No tasks match the current search or filter criteria.
                </td>
              </tr>
            ) : (
              displayedTasks.map((task, index) => (
                <tr
                  key={index}
                  className={
                    selectedTaskIds.includes(task.id) ? "selected" : ""
                  }
                >
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(task.id)}
                      onChange={() => handleToggleSelect(task.id)}
                    />
                  </td>
                  <td className="mono strong">{task.id}</td>
                  <td>{task.title}</td>
                  <td className="muted">{task.category}</td>
                  <td>
                    <span className={`pill ${task.priority.toLowerCase()}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status ${task.status.replace(" ", "").toLowerCase()}`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td>
                    <input
                      className="units"
                      type="number"
                      value={task.stockUnits}
                      onChange={(e) =>
                        handleStockChange(task.id, e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="note"
                      type="text"
                      placeholder="Quick manager note..."
                      value={notes[task.id] || ""}
                      onChange={(e) =>
                        handleNoteChange(task.id, e.target.value)
                      }
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
