// Simple Todo App script
// Step 1 – DOM element references & constants
const newTodoInput = document.getElementById('new-todo-input');
const addTodoBtn = document.getElementById('add-todo-btn');
const todoListEl = document.getElementById('todo-list');
const clearCompletedBtn = document.getElementById('clear-completed-btn');

// Step 2 – Data model & persistence utilities
class TodoItem {
    constructor(id, text, completed = false) {
        this.id = id;
        this.text = text;
        this.completed = completed;
    }
}

const STORAGE_KEY = 'simple_todo_items';

function loadTodos() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw).map(obj => new TodoItem(obj.id, obj.text, obj.completed)) : [];
}

function saveTodos(todos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// Step 3 – In‑memory state
let todos = loadTodos();

// Step 4 – Rendering function
function renderTodos() {
    // Clear existing list
    todoListEl.innerHTML = '';
    // Render each todo item
    todos.forEach(todo => {
        const li = document.createElement('li');
        li.className = 'todo-item';
        li.dataset.id = todo.id;
        if (todo.completed) li.classList.add('completed');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = todo.completed;
        checkbox.className = 'toggle-complete';
        checkbox.addEventListener('change', () => toggleComplete(todo.id));

        const span = document.createElement('span');
        span.textContent = todo.text;
        span.className = 'todo-text';

        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.className = 'delete-btn';
        delBtn.addEventListener('click', () => deleteTodo(todo.id));

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(delBtn);
        todoListEl.appendChild(li);
    });
}

// Step 5 – CRUD operation helpers
function addTodo(text) {
    const id = Date.now().toString();
    const newTodo = new TodoItem(id, text);
    todos.push(newTodo);
    saveTodos(todos);
    renderTodos();
}

function toggleComplete(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        saveTodos(todos);
        renderTodos();
    }
}

function deleteTodo(id) {
    todos = todos.filter(t => t.id !== id);
    saveTodos(todos);
    renderTodos();
}

function clearCompleted() {
    todos = todos.filter(t => !t.completed);
    saveTodos(todos);
    renderTodos();
}

// Step 6 – Event listeners
addTodoBtn.addEventListener('click', () => {
    const text = newTodoInput.value.trim();
    if (text) {
        addTodo(text);
        newTodoInput.value = '';
    }
});

newTodoInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
        addTodoBtn.click();
    }
});

clearCompletedBtn.addEventListener('click', clearCompleted);

// Step 7 – Initialization
renderTodos();
